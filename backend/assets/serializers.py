from rest_framework import serializers

from inventory.serializers import ManagedObjectIdentitySerializer

from .models import Pager, PagerType, Radio, RadioModel, RicCode


class PagerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagerType
        fields = ["id", "name"]


class RadioModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = RadioModel
        fields = ["id", "manufacturer", "name", "application"]
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
            "application",
            "model",
            "fireplan_id",
            "fireplan_qr_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


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
