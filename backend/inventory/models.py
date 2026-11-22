from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone


class ManagedObject(models.Model):
    class Kind(models.TextChoices):
        PAGER = "pager", "Pager"
        RADIO = "radio", "Radio"
        VEHICLE = "vehicle", "Vehicle"
        VECTOR = "vector", "Vector"

    kind = models.CharField(max_length=20, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} #{self.pk}"

    @property
    def expected_location(self):
        assignment = (
            self.outgoing_relationships.filter(
                kind=ManagedRelationship.Kind.ASSIGNED_TO,
                ended_at__isnull=True,
            )
            .select_related("target")
            .first()
        )
        if assignment is None:
            return None
        from citygis.models import Vector, Vehicle

        target = assignment.target
        vector = Vector.objects.filter(managed_object=target).select_related("service").first()
        if vector:
            return vector.vehicle.managed_object if vector.vehicle_id else None
        vehicle = Vehicle.objects.filter(managed_object=target).first()
        return vehicle.managed_object if vehicle else target


class ManagedRelationship(models.Model):
    class Kind(models.TextChoices):
        ASSIGNED_TO = "assigned_to", "Operationally assigned to"
        MOUNTED_IN = "mounted_in", "Mounted in"
        INSTALLED_IN = "installed_in", "Installed in"
        CONTAINS = "contains", "Contains"

    source = models.ForeignKey(
        ManagedObject, on_delete=models.CASCADE, related_name="outgoing_relationships"
    )
    target = models.ForeignKey(
        ManagedObject,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="incoming_relationships",
    )
    target_location = models.ForeignKey(
        "citygis.Location",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="asset_relationships",
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["started_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(target__isnull=False, target_location__isnull=True)
                    | Q(target__isnull=True, target_location__isnull=False)
                ),
                name="managed_relationship_one_target",
            ),
            models.CheckConstraint(
                condition=Q(target__isnull=True) | ~Q(source=models.F("target")),
                name="managed_relationship_no_self_link",
            ),
            models.UniqueConstraint(
                fields=["source"],
                condition=Q(kind="assigned_to", ended_at__isnull=True),
                name="uniq_active_operational_assignment",
            ),
        ]

    def clean(self):
        super().clean()
        if (self.target_id is None) == (self.target_location_id is None):
            raise ValidationError("Geef precies één relatiebestemming op.")
        if self.source_id and self.source.kind == ManagedObject.Kind.RADIO:
            from citygis.models import Vector, Vehicle

            valid = False
            if self.kind == self.Kind.ASSIGNED_TO:
                valid = (
                    self.target_id is not None
                    and Vector.objects.filter(managed_object_id=self.target_id).exists()
                )
            elif self.kind == self.Kind.MOUNTED_IN:
                valid = (
                    self.target_id is not None
                    and Vehicle.objects.filter(managed_object_id=self.target_id).exists()
                )
            elif self.kind == self.Kind.INSTALLED_IN:
                valid = self.target_location_id is not None
            if not valid:
                raise ValidationError("De bestemming past niet bij het relatietype.")

    @classmethod
    def assign_operationally(cls, source: ManagedObject, target: ManagedObject):
        if source.kind == ManagedObject.Kind.VECTOR:
            raise ValueError("Operational assignments must start from a physical asset.")
        with transaction.atomic():
            locked_source = ManagedObject.objects.select_for_update().get(pk=source.pk)
            current = cls.objects.filter(
                source=locked_source,
                kind=cls.Kind.ASSIGNED_TO,
                ended_at__isnull=True,
            ).first()
            if current and current.target_id == target.pk:
                return current
            if current:
                current.ended_at = timezone.now()
                current.save(update_fields=["ended_at"])
            return cls.objects.create(
                source=locked_source,
                target=target,
                kind=cls.Kind.ASSIGNED_TO,
            )

    @classmethod
    def relate(
        cls,
        source: ManagedObject,
        kind: str,
        *,
        target: ManagedObject | None = None,
        target_location=None,
    ):
        if (target is None) == (target_location is None):
            raise ValueError("Geef precies één relatiebestemming op.")
        with transaction.atomic():
            locked_source = ManagedObject.objects.select_for_update().get(pk=source.pk)
            current = cls.objects.filter(
                source=locked_source, kind=kind, ended_at__isnull=True
            ).first()
            target_id = target.pk if target else None
            location_id = target_location.pk if target_location else None
            if (
                current
                and current.target_id == target_id
                and current.target_location_id == location_id
            ):
                return current
            now = timezone.now()
            if locked_source.kind == ManagedObject.Kind.RADIO:
                active_relations = cls.objects.filter(source=locked_source, ended_at__isnull=True)
                if current:
                    active_relations = active_relations.exclude(pk=current.pk)
                active_relations.update(ended_at=now)
            if current:
                current.ended_at = now
                current.save(update_fields=["ended_at"])
            relation = cls(
                source=locked_source,
                target=target,
                target_location=target_location,
                kind=kind,
                started_at=now,
            )
            relation.full_clean()
            relation.save()
            return relation

    @classmethod
    def clear(cls, source: ManagedObject, kind: str):
        with transaction.atomic():
            locked_source = ManagedObject.objects.select_for_update().get(pk=source.pk)
            current = cls.objects.filter(
                source=locked_source, kind=kind, ended_at__isnull=True
            ).first()
            if current:
                current.ended_at = timezone.now()
                current.save(update_fields=["ended_at"])
            return current

    def __str__(self) -> str:
        destination = self.target or self.target_location
        return f"{self.source} {self.get_kind_display()} {destination}"


class PhysicalLocationObservation(models.Model):
    asset = models.ForeignKey(
        ManagedObject, on_delete=models.CASCADE, related_name="location_observations"
    )
    location = models.ForeignKey(
        "citygis.Location", on_delete=models.PROTECT, related_name="observations"
    )
    observed_at = models.DateTimeField(default=timezone.now)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-observed_at", "-id"]
