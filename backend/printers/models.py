from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

TAPE_WIDTH_CHOICES = (
    (6, "6 mm"),
    (12, "12 mm"),
    (18, "18 mm"),
    (24, "24 mm"),
    (36, "36 mm"),
)


class Printer(models.Model):
    name = models.CharField(max_length=120)
    manufacturer = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    ip_address = models.GenericIPAddressField()
    port = models.PositiveIntegerField(
        default=9100, validators=[MinValueValidator(1), MaxValueValidator(65535)]
    )
    tape_width_mm = models.PositiveSmallIntegerField(choices=TAPE_WIDTH_CHOICES, default=12)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "label_printers"
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.manufacturer} {self.model})"
