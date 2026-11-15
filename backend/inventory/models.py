from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone


class ManagedObject(models.Model):
    class Kind(models.TextChoices):
        PAGER = "pager", "Pager"
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
        ManagedObject, on_delete=models.CASCADE, related_name="incoming_relationships"
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["started_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(source=models.F("target")), name="managed_relationship_no_self_link"
            ),
            models.UniqueConstraint(
                fields=["source"],
                condition=Q(kind="assigned_to", ended_at__isnull=True),
                name="uniq_active_operational_assignment",
            ),
        ]

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

    def __str__(self) -> str:
        return f"{self.source} {self.get_kind_display()} {self.target}"


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
