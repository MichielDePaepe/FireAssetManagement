from rest_framework import serializers

from .models import Printer

SUPPORTED_PRINTER_MODELS = {("Brother", "PT-P900W")}


class PrinterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Printer
        fields = [
            "id",
            "name",
            "manufacturer",
            "model",
            "ip_address",
            "port",
            "tape_width_mm",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Vul een printernaam in.")
        return value

    def validate_manufacturer(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Vul een printermerk in.")
        return value

    def validate_model(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Vul een printermodel in.")
        return value

    def validate(self, attrs):
        manufacturer = attrs.get("manufacturer", getattr(self.instance, "manufacturer", ""))
        model = attrs.get("model", getattr(self.instance, "model", ""))
        if (manufacturer, model) not in SUPPORTED_PRINTER_MODELS:
            raise serializers.ValidationError(
                {"model": "Momenteel wordt alleen Brother PT-P900W ondersteund."}
            )
        return attrs
