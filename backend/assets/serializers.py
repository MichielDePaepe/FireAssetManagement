from rest_framework import serializers

from inventory.serializers import ManagedObjectIdentitySerializer

from .models import (
    Issi,
    Manufacturer,
    Organization,
    Pager,
    PagerType,
    Radio,
    RadioModel,
    RadioSubscription,
    RicCode,
    TeiRange,
    _tei_numeric_value,
)


class ManufacturerNameField(serializers.Field):
    """Expose manufacturer names while storing normalized FK records."""

    default_error_messages = {"invalid": "Geef een geldige fabrikantnaam op."}

    def to_representation(self, value):
        return value.name

    def to_internal_value(self, data):
        if not isinstance(data, str) or not data.strip() or len(data.strip()) > 100:
            self.fail("invalid")
        manufacturer, _ = Manufacturer.objects.get_or_create(name=data.strip())
        return manufacturer


class PagerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagerType
        fields = ["id", "name"]


class RadioModelSerializer(serializers.ModelSerializer):
    manufacturer = ManufacturerNameField()
    manufacturer_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = RadioModel
        fields = ["id", "manufacturer", "manufacturer_id", "name"]
        read_only_fields = fields


class RadioSerializer(serializers.ModelSerializer):
    managed_object = ManagedObjectIdentitySerializer(read_only=True)
    model = RadioModelSerializer(read_only=True)

    class Meta:
        model = Radio
        fields = [
            "id",
            "managed_object",
            "tei",
            "manufacturer",
            "model_name",
            "model",
            "fireplan_id",
            "fireplan_qr_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name"]
        read_only_fields = ["id"]


class ManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manufacturer
        fields = ["id", "name"]
        read_only_fields = ["id"]


class IssiSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization", queryset=Organization.objects.all(), allow_null=True, required=False,
        write_only=True,
    )

    class Meta:
        model = Issi
        fields = ["id", "issi", "alias", "organization", "organization_id"]
        read_only_fields = ["id"]


class RadioModelManagementSerializer(serializers.ModelSerializer):
    manufacturer = serializers.CharField(source="manufacturer.name", read_only=True)
    manufacturer_id = serializers.PrimaryKeyRelatedField(
        source="manufacturer", queryset=Manufacturer.objects.all()
    )

    class Meta:
        model = RadioModel
        fields = ["id", "manufacturer", "manufacturer_id", "name"]
        read_only_fields = ["id", "manufacturer"]


class TeiRangeSerializer(serializers.ModelSerializer):
    model = RadioModelManagementSerializer(read_only=True)
    model_id = serializers.PrimaryKeyRelatedField(
        source="model", queryset=RadioModel.objects.all(), write_only=True
    )

    class Meta:
        model = TeiRange
        fields = ["id", "model", "model_id", "start_tei", "end_tei"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        model = attrs.get("model", getattr(self.instance, "model", None))
        start = attrs.get("start_tei", getattr(self.instance, "start_tei", None))
        end = attrs.get("end_tei", getattr(self.instance, "end_tei", None))
        if model and start and end:
            start_value = _tei_numeric_value(start)
            end_value = _tei_numeric_value(end)
            if start_value > end_value:
                raise serializers.ValidationError(
                    {"end_tei": "Het eind van het TEI-bereik moet na het begin liggen."}
                )
            ranges = TeiRange.objects.all()
            if self.instance:
                ranges = ranges.exclude(pk=self.instance.pk)
            if any(
                _tei_numeric_value(row.start_tei) <= end_value
                and _tei_numeric_value(row.end_tei) >= start_value
                for row in ranges
            ):
                raise serializers.ValidationError(
                    {"start_tei": "Dit TEI-bereik overlapt een bestaand bereik."}
                )
        return attrs


class RadioSubscriptionSerializer(serializers.ModelSerializer):
    radio = serializers.SerializerMethodField()
    issi = serializers.SerializerMethodField()
    radio_id = serializers.PrimaryKeyRelatedField(
        source="radio", queryset=Radio.objects.all(), write_only=True, required=False
    )
    issi_id = serializers.PrimaryKeyRelatedField(
        source="issi", queryset=Issi.objects.all(), write_only=True, required=False
    )

    class Meta:
        model = RadioSubscription
        fields = ["id", "radio", "radio_id", "issi", "issi_id", "started_at", "ended_at"]
        read_only_fields = ["id", "started_at", "ended_at"]

    def get_radio(self, instance):
        return {"id": instance.radio_id, "tei": instance.radio.tei}

    def get_issi(self, instance):
        return {"id": instance.issi_id, "issi": instance.issi.issi, "alias": instance.issi.alias}


class RadioManagementSerializer(serializers.ModelSerializer):
    managed_object = ManagedObjectIdentitySerializer(read_only=True)
    model = RadioModelManagementSerializer(read_only=True)
    model_id = serializers.PrimaryKeyRelatedField(
        source="model", queryset=RadioModel.objects.all(), allow_null=True, required=False,
        write_only=True,
    )
    current_subscription = serializers.SerializerMethodField()
    subscription_history = serializers.SerializerMethodField()

    class Meta:
        model = Radio
        fields = [
            "id", "managed_object", "tei", "manufacturer", "model_name",
            "model", "model_id", "fireplan_id", "fireplan_qr_url", "created_at", "updated_at",
            "current_subscription", "subscription_history",
        ]
        read_only_fields = [
            "id", "fireplan_id", "fireplan_qr_url", "created_at", "updated_at",
            "current_subscription", "subscription_history",
        ]

    def get_current_subscription(self, instance):
        subscription = (
            instance.subscription_history.filter(ended_at__isnull=True)
            .select_related("issi")
            .first()
        )
        return RadioSubscriptionSerializer(subscription).data if subscription else None

    def get_subscription_history(self, instance):
        history = instance.subscription_history.select_related("issi").order_by("started_at", "id")
        return RadioSubscriptionSerializer(history, many=True).data


class IssiManagementSerializer(IssiSerializer):
    current_subscription = serializers.SerializerMethodField()
    subscription_history = serializers.SerializerMethodField()

    class Meta(IssiSerializer.Meta):
        fields = [*IssiSerializer.Meta.fields, "current_subscription", "subscription_history"]
        read_only_fields = ["id", "current_subscription", "subscription_history"]

    def get_current_subscription(self, instance):
        subscription = (
            instance.subscription_history.filter(ended_at__isnull=True)
            .select_related("radio")
            .first()
        )
        return RadioSubscriptionSerializer(subscription).data if subscription else None

    def get_subscription_history(self, instance):
        history = instance.subscription_history.select_related("radio").order_by("started_at", "id")
        return RadioSubscriptionSerializer(history, many=True).data


class PagerSerializer(serializers.ModelSerializer):
    managed_object = ManagedObjectIdentitySerializer(read_only=True)
    type = PagerTypeSerializer(read_only=True)
    type_id = serializers.PrimaryKeyRelatedField(
        source="type", queryset=PagerType.objects.all(), write_only=True
    )

    class Meta:
        model = Pager
        fields = [
            "id",
            "managed_object",
            "serial_number",
            "type",
            "type_id",
            "fireplan_id",
            "fireplan_qr_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "fireplan_id", "fireplan_qr_url", "created_at", "updated_at"]

    def validate_serial_number(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Vul een serienummer in.")
        return value


class RicCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RicCode
        fields = ["id", "ric_code", "adc_code", "alias"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        for field in ("ric_code", "adc_code", "alias"):
            value = attrs.get(field)
            if isinstance(value, str):
                attrs[field] = value.strip()
                if not attrs[field]:
                    raise serializers.ValidationError({field: "Dit veld is verplicht."})
        for field in ("ric_code", "adc_code"):
            value = attrs.get(field)
            if value is not None and not (value.isascii() and value.isdecimal()):
                raise serializers.ValidationError({field: "Gebruik alleen cijfers."})
        ric_code = attrs.get("ric_code", getattr(self.instance, "ric_code", None))
        adc_code = attrs.get("adc_code", getattr(self.instance, "adc_code", None))
        duplicates = RicCode.objects.filter(ric_code=ric_code, adc_code=adc_code)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                {"non_field_errors": ["Deze RiC–AdC-combinatie bestaat al."]}
            )
        return attrs
