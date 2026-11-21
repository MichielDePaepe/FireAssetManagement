from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from inventory.models import ManagedObject


class RadioApplication(models.TextChoices):
    PORTABLE = "portable", "Draagbaar"
    VEHICLE = "vehicle", "Voertuiggebonden"
    FIXED = "fixed", "Vast"


tei_validator = RegexValidator(
    regex=r"^(?:[0-9A-Fa-f]{14}|[0-9A-Fa-f]{15})$",
    message="Een TEI bevat 14 of 15 hexadecimale tekens.",
)


def _is_valid_tei(value: str) -> bool:
    return len(value) in {14, 15} and all(
        character in "0123456789abcdefABCDEF" for character in value
    )


class RadioModel(models.Model):
    Application = RadioApplication

    manufacturer = models.CharField(max_length=100)
    name = models.CharField(max_length=120)
    application = models.CharField(max_length=20, choices=RadioApplication.choices)

    class Meta:
        ordering = ["manufacturer", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["manufacturer", "name", "application"], name="uniq_radio_model_application"
            )
        ]

    def __str__(self) -> str:
        return f"{self.manufacturer} {self.name}"

    @classmethod
    def for_tei(cls, tei: str, application: str | None = None):
        try:
            numeric_tei = int(tei, 16)
        except (TypeError, ValueError):
            return None
        ranges = TeiRange.objects.select_related("model")
        if application is not None:
            ranges = ranges.filter(model__application=application)
        for tei_range in ranges:
            if int(tei_range.start_tei, 16) <= numeric_tei <= int(tei_range.end_tei, 16):
                return tei_range.model
        return None


class TeiRange(models.Model):
    model = models.ForeignKey(RadioModel, on_delete=models.CASCADE, related_name="tei_ranges")
    start_tei = models.CharField(max_length=15, validators=[tei_validator])
    end_tei = models.CharField(max_length=15, validators=[tei_validator])

    class Meta:
        ordering = ["start_tei", "id"]

    def clean(self):
        super().clean()
        start = (self.start_tei or "").upper()
        end = (self.end_tei or "").upper()
        errors = {}
        valid_start = _is_valid_tei(start)
        valid_end = _is_valid_tei(end)
        if valid_start and valid_end and int(start, 16) > int(end, 16):
            errors["end_tei"] = "Het eind van het TEI-bereik moet na het begin liggen."
        if valid_start and valid_end and self.model_id:
            start_value = int(start, 16)
            end_value = int(end, 16)
            existing_ranges = TeiRange.objects.all()
            if self.pk:
                existing_ranges = existing_ranges.exclude(pk=self.pk)
            if any(
                int(row.start_tei, 16) <= end_value and int(row.end_tei, 16) >= start_value
                for row in existing_ranges
            ):
                errors["start_tei"] = "Dit TEI-bereik overlapt een bestaand bereik."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.start_tei = self.start_tei.upper()
        self.end_tei = self.end_tei.upper()
        with transaction.atomic():
            # Serialize range changes across models so overlapping ranges cannot race.
            from django.db import connection

            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_xact_lock(4102, 1)")
            self.full_clean()
            return super().save(*args, **kwargs)


class Radio(models.Model):
    Application = RadioApplication

    managed_object = models.OneToOneField(
        ManagedObject, on_delete=models.CASCADE, related_name="radio"
    )
    tei = models.CharField(max_length=15, unique=True, validators=[tei_validator])
    manufacturer = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=120, blank=True)
    application = models.CharField(max_length=20, choices=RadioApplication.choices)
    model = models.ForeignKey(
        RadioModel, null=True, blank=True, on_delete=models.PROTECT, related_name="radios"
    )
    fireplan_id = models.PositiveBigIntegerField(null=True, blank=True, unique=True)
    fireplan_qr_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tei"]

    def __str__(self) -> str:
        return self.tei

    def save(self, *args, **kwargs):
        if self.model_id is None:
            self.model = RadioModel.for_tei(self.tei, self.application)
        if self.managed_object_id:
            return super().save(*args, **kwargs)
        with transaction.atomic():
            self.managed_object = ManagedObject.objects.create(kind=ManagedObject.Kind.RADIO)
            return super().save(*args, **kwargs)


class Organization(models.Model):
    name = models.CharField(max_length=160, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Issi(models.Model):
    issi = models.CharField(max_length=20, unique=True)
    alias = models.CharField(max_length=120)
    organization = models.ForeignKey(
        Organization, null=True, blank=True, on_delete=models.PROTECT, related_name="issis"
    )

    class Meta:
        ordering = ["issi"]

    def __str__(self) -> str:
        return f"{self.issi} ({self.alias})"


class RadioSubscription(models.Model):
    radio = models.ForeignKey(Radio, on_delete=models.CASCADE, related_name="subscription_history")
    issi = models.ForeignKey(Issi, on_delete=models.CASCADE, related_name="subscription_history")
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["started_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["radio"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_issi_per_radio",
            ),
            models.UniqueConstraint(
                fields=["issi"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_radio_per_issi",
            ),
        ]

    @classmethod
    def assign(cls, radio: Radio, issi: Issi):
        with transaction.atomic():
            locked_radio = Radio.objects.select_for_update().get(pk=radio.pk)
            locked_issi = Issi.objects.select_for_update().get(pk=issi.pk)
            current = cls.objects.filter(
                radio=locked_radio, issi=locked_issi, ended_at__isnull=True
            ).first()
            if current:
                return current
            now = timezone.now()
            cls.objects.filter(
                Q(radio=locked_radio) | Q(issi=locked_issi), ended_at__isnull=True
            ).update(ended_at=now)
            return cls.objects.create(radio=locked_radio, issi=locked_issi, started_at=now)


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
