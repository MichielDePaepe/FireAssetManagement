from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from inventory.models import ManagedObject

tei_validator = RegexValidator(
    regex=r"^[0-9]{15}$",
    message="Een TEI bevat precies 15 cijfers.",
)


def normalize_tei(value: str) -> str:
    """Append the missing trailing zero to 14-digit source TEIs."""
    if len(value) == 14 and all(character in "0123456789" for character in value):
        return f"{value}0"
    return value


def _is_valid_tei(value: str) -> bool:
    return len(value) == 15 and all(character in "0123456789" for character in value)


def _tei_numeric_value(value: str) -> int:
    """Return the decimal TEI value without converting it to a number for storage."""
    return int(normalize_tei(value), 10)


class Manufacturer(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RadioModel(models.Model):
    manufacturer = models.ForeignKey(
        Manufacturer, on_delete=models.PROTECT, related_name="radio_models"
    )
    name = models.CharField(max_length=120)

    class Meta:
        ordering = ["manufacturer__name", "name"]

    def __str__(self) -> str:
        return f"{self.manufacturer} {self.name}"

    @classmethod
    def for_tei(cls, tei: str):
        try:
            numeric_tei = _tei_numeric_value(tei)
        except (TypeError, ValueError):
            return None
        for tei_range in TeiRange.objects.select_related("model", "model__manufacturer"):
            if (
                _tei_numeric_value(tei_range.start_tei)
                <= numeric_tei
                <= _tei_numeric_value(tei_range.end_tei)
            ):
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
        start = normalize_tei(self.start_tei or "")
        end = normalize_tei(self.end_tei or "")
        errors = {}
        valid_start = _is_valid_tei(start)
        valid_end = _is_valid_tei(end)
        if valid_start and valid_end and _tei_numeric_value(start) > _tei_numeric_value(end):
            errors["end_tei"] = "Het eind van het TEI-bereik moet na het begin liggen."
        if valid_start and valid_end and self.model_id:
            start_value = _tei_numeric_value(start)
            end_value = _tei_numeric_value(end)
            existing_ranges = TeiRange.objects.all()
            if self.pk:
                existing_ranges = existing_ranges.exclude(pk=self.pk)
            if any(
                _tei_numeric_value(row.start_tei) <= end_value
                and _tei_numeric_value(row.end_tei) >= start_value
                for row in existing_ranges
            ):
                errors["start_tei"] = "Dit TEI-bereik overlapt een bestaand bereik."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.start_tei = normalize_tei(self.start_tei)
        self.end_tei = normalize_tei(self.end_tei)
        with transaction.atomic():
            # Serialize range changes across models so overlapping ranges cannot race.
            from django.db import connection

            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_xact_lock(4102, 1)")
            self.full_clean()
            return super().save(*args, **kwargs)


class Radio(models.Model):
    managed_object = models.OneToOneField(
        ManagedObject, on_delete=models.CASCADE, related_name="radio"
    )
    tei = models.CharField(max_length=15, unique=True, validators=[tei_validator])
    manufacturer = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=120, blank=True)
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

    def clean(self):
        self.tei = normalize_tei(self.tei)

    def save(self, *args, **kwargs):
        self.tei = normalize_tei(self.tei)
        tei_validator(self.tei)
        if self.model_id is None:
            self.model = RadioModel.for_tei(self.tei)
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
    def assign(cls, radio: Radio, issi: Issi, started_at=None):
        with transaction.atomic():
            locked_radio = Radio.objects.select_for_update().get(pk=radio.pk)
            locked_issi = Issi.objects.select_for_update().get(pk=issi.pk)
            current = cls.objects.filter(
                radio=locked_radio, issi=locked_issi, ended_at__isnull=True
            ).first()
            if current:
                if started_at and started_at < current.started_at:
                    current.started_at = started_at
                    current.save(update_fields=["started_at"])
                return current
            now = started_at or timezone.now()
            conflicts = list(cls.objects.select_for_update().filter(
                Q(radio=locked_radio) | Q(issi=locked_issi), ended_at__isnull=True
            ))
            future_conflicts = [row.started_at for row in conflicts if row.started_at > now]
            if future_conflicts:
                # A CSV may contain older history than a manually-created current assignment.
                # Insert the imported interval before that assignment without closing it early.
                return cls.objects.create(
                    radio=locked_radio,
                    issi=locked_issi,
                    started_at=now,
                    ended_at=min(future_conflicts),
                )
            cls.objects.filter(pk__in=[row.pk for row in conflicts]).update(ended_at=now)
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
