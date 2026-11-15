from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from inventory.models import ManagedObject


class PagerType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "pager_types"
        ordering = ["name"]
        verbose_name = "pager type"
        verbose_name_plural = "pager types"

    def __str__(self) -> str:
        return self.name


class Pager(models.Model):
    managed_object = models.OneToOneField(
        ManagedObject, on_delete=models.CASCADE, related_name="pager"
    )
    serial_number = models.CharField(max_length=100, unique=True)
    type = models.ForeignKey(PagerType, on_delete=models.PROTECT, related_name="pagers")
    fireplan_id = models.PositiveBigIntegerField(null=True, blank=True, unique=True)
    fireplan_qr_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pager_assets"
        ordering = ["serial_number"]

    def __str__(self) -> str:
        return f"{self.serial_number} ({self.type})"

    def save(self, *args, **kwargs):
        if self.managed_object_id:
            return super().save(*args, **kwargs)
        with transaction.atomic():
            self.managed_object = ManagedObject.objects.create(kind=ManagedObject.Kind.PAGER)
            return super().save(*args, **kwargs)


class RicCode(models.Model):
    ric_code = models.CharField(max_length=20)
    adc_code = models.CharField(max_length=20)
    alias = models.CharField(max_length=100)

    class Meta:
        db_table = "ric_codes"
        ordering = ["alias", "ric_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["ric_code", "adc_code"],
                name="uniq_ric_adc_pair",
            )
        ]

    def __str__(self) -> str:
        return f"RiC {self.ric_code} / AdC {self.adc_code} — {self.alias}"


class RicCodeVectorRelationship(models.Model):
    code = models.ForeignKey(RicCode, on_delete=models.CASCADE, related_name="vector_relationships")
    vector = models.ForeignKey(
        "citygis.Vector", on_delete=models.CASCADE, related_name="ric_code_relationships"
    )
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["started_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_vector_per_ric_code",
            )
        ]

    @classmethod
    def assign(cls, code: RicCode, vector):
        with transaction.atomic():
            locked_code = RicCode.objects.select_for_update().get(pk=code.pk)
            current = cls.objects.filter(code=locked_code, ended_at__isnull=True).first()
            if current and current.vector_id == vector.pk:
                return current
            if current:
                current.ended_at = timezone.now()
                current.save(update_fields=["ended_at"])
            return cls.objects.create(code=locked_code, vector=vector)
