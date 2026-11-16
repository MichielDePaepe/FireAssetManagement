from rest_framework import serializers

from inventory.serializers import ManagedObjectIdentitySerializer

from .models import Location, Service, Vector, VectorStatus, VectorStatusHistory, Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    managed_object = ManagedObjectIdentitySerializer(read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "managed_object",
            "fireplan_id",
            "alphacode",
            "plate",
            "utilisation",
            "chassis",
            "fleet_status",
            "is_current",
            "last_seen_at",
        ]


class VectorStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = VectorStatus
        fields = ["code", "description", "abbreviation", "color"]


class VectorStatusHistorySerializer(serializers.ModelSerializer):
    status_since = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()
    status_description = serializers.SerializerMethodField()
    status_abbreviation = serializers.SerializerMethodField()
    status_color = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = VectorStatusHistory
        fields = [
            "id",
            "status_code",
            "status_description",
            "status_abbreviation",
            "status_color",
            "status_since",
            "observed_at",
            "ended_at",
            "duration_seconds",
            "is_current",
        ]

    def _catalog_status(self, obj):
        return self.context["status_catalog"].get(obj.status_code)

    def get_status_since(self, obj):
        return obj.source_effective_at or obj.observed_at

    def get_duration_seconds(self, obj):
        start = obj.source_effective_at or obj.observed_at
        end = obj.ended_at or self.context["now"]
        return max(0, int((end - start).total_seconds()))

    def get_status_description(self, obj):
        status = self._catalog_status(obj)
        return status.description if status else None

    def get_status_abbreviation(self, obj):
        status = self._catalog_status(obj)
        return status.abbreviation if status else None

    def get_status_color(self, obj):
        status = self._catalog_status(obj)
        return status.color if status else None

    def get_is_current(self, obj):
        return obj.ended_at is None


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "abbreviation"]


class ServiceOptionSerializer(ServiceSerializer):
    location_id = serializers.SerializerMethodField()

    class Meta(ServiceSerializer.Meta):
        fields = ["id", "abbreviation", "location_id"]

    def get_location_id(self, obj):
        location = getattr(obj, "location", None)
        return location.pk if location else None


class LocationSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(read_only=True)
    service_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Location
        fields = ["id", "name", "kind", "parent_id", "service_id"]


class LocationManagementSerializer(serializers.ModelSerializer):
    """Writable local location fields; CityGIS services remain read-only records."""

    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent", queryset=Location.objects.all(), allow_null=True, required=False
    )
    service_id = serializers.PrimaryKeyRelatedField(
        source="service", queryset=Service.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Location
        fields = ["id", "name", "kind", "parent_id", "service_id"]
        read_only_fields = ["id"]

    def to_internal_value(self, data):
        unknown_fields = set(data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError(
                {
                    field: "Dit veld kan niet via locatiebeheer worden aangepast."
                    for field in unknown_fields
                }
            )
        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = self.instance
        kind = attrs.get("kind", instance.kind if instance else Location.Kind.OTHER)
        parent = attrs.get("parent", instance.parent if instance else None)
        service = attrs.get("service", instance.service if instance else None)

        if service and kind != Location.Kind.POST:
            raise serializers.ValidationError(
                {"service_id": "Alleen posten kunnen een dienst hebben."}
            )

        if service:
            existing = Location.objects.filter(service=service)
            if instance:
                existing = existing.exclude(pk=instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"service_id": "Deze dienst is al aan een locatie gekoppeld."}
                )

        if instance:
            ancestor = parent
            while ancestor is not None:
                if ancestor.pk == instance.pk:
                    raise serializers.ValidationError(
                        {
                            "parent_id": (
                                "Een locatie kan geen ouder zijn van zichzelf of een voorouder."
                            )
                        }
                    )
                ancestor = ancestor.parent

        return attrs


class VectorSerializer(serializers.ModelSerializer):
    managed_object = ManagedObjectIdentitySerializer(read_only=True)
    service = ServiceSerializer(read_only=True)
    post = LocationSerializer(read_only=True)
    vehicle = VehicleSerializer(read_only=True)
    status_description = serializers.SerializerMethodField()
    status_abbreviation = serializers.SerializerMethodField()
    status_color = serializers.SerializerMethodField()

    class Meta:
        model = Vector
        fields = [
            "id",
            "managed_object",
            "vector_code",
            "name",
            "abbreviation",
            "service_abbreviation",
            "service",
            "post",
            "resource_type_code",
            "resource_code",
            "operational_status_code",
            "status_description",
            "status_abbreviation",
            "status_updated_at",
            "status_color",
            "vehicle",
            "source_vehicle_name",
            "is_current",
            "last_seen_at",
        ]

    def _status(self, obj):
        catalog = self.context.get("status_catalog")
        if catalog is not None:
            return catalog.get(obj.operational_status_code)
        return VectorStatus.objects.filter(pk=obj.operational_status_code).first()

    def get_status_description(self, obj):
        status = self._status(obj)
        return status.description if status else None

    def get_status_abbreviation(self, obj):
        status = self._status(obj)
        return status.abbreviation if status else None

    def get_status_color(self, obj):
        status = self._status(obj)
        return status.color if status else None
