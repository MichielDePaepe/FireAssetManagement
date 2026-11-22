from rest_framework import serializers

from citygis.models import Location, Vector

from .models import ManagedObject, ManagedRelationship


class ManagedObjectIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ManagedObject
        fields = ["id", "kind"]
        read_only_fields = fields


class VectorAssignmentSerializer(serializers.Serializer):
    vector_id = serializers.IntegerField(allow_null=True)

    def validate_vector_id(self, value):
        if value is not None and not Vector.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Deze vector bestaat niet.")
        return value

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) != {"vector_id"}:
            raise serializers.ValidationError(
                {"detail": "Geef alleen vector_id op om de toepassingseigen koppeling te wijzigen."}
            )
        return super().to_internal_value(data)


class RadioRelationshipSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ManagedRelationship.Kind.choices)
    target_object_id = serializers.PrimaryKeyRelatedField(
        source="target", queryset=ManagedObject.objects.all(), allow_null=True
    )
    location_id = serializers.PrimaryKeyRelatedField(
        source="target_location", queryset=Location.objects.all(), allow_null=True
    )

    def to_internal_value(self, data):
        expected = {"kind", "target_object_id", "location_id"}
        if not isinstance(data, dict) or set(data) != expected:
            raise serializers.ValidationError(
                {"detail": "Geef kind, target_object_id en location_id op."}
            )
        return super().to_internal_value(data)

    def validate(self, attrs):
        target = attrs["target"]
        location = attrs["target_location"]
        if target is not None and location is not None:
            raise serializers.ValidationError("Kies één relatiebestemming.")
        return attrs


class RadioRelationshipHistorySerializer(serializers.ModelSerializer):
    target = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = ManagedRelationship
        fields = ["id", "kind", "target", "location", "started_at", "ended_at"]
        read_only_fields = fields

    def get_target(self, instance):
        if not instance.target_id:
            return None
        return {"id": instance.target_id, "kind": instance.target.kind}

    def get_location(self, instance):
        if not instance.target_location_id:
            return None
        return {
            "id": instance.target_location_id,
            "name": instance.target_location.name,
            "kind": instance.target_location.kind,
        }
