from rest_framework import serializers

from citygis.models import Vector

from .models import ManagedObject


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
