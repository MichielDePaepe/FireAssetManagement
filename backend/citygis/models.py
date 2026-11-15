from django.db import models, transaction
from django.db.models import Q

from inventory.models import ManagedObject


class Vehicle(models.Model):
    """Physical fleet vehicle imported from Fireplan."""

    managed_object = models.OneToOneField(
        ManagedObject, on_delete=models.CASCADE, related_name="vehicle"
    )

    fireplan_id = models.PositiveBigIntegerField(unique=True)
    alphacode = models.CharField(max_length=80, db_index=True)
    plate = models.CharField(max_length=40, blank=True)
    utilisation = models.CharField(max_length=255, blank=True)
    chassis = models.CharField(max_length=100, blank=True)
    fleet_status = models.CharField(max_length=80, blank=True)
    is_current = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["alphacode", "fireplan_id"]

    def __str__(self) -> str:
        return self.alphacode

    def save(self, *args, **kwargs):
        if self.managed_object_id:
            return super().save(*args, **kwargs)
        with transaction.atomic():
            self.managed_object = ManagedObject.objects.create(kind=ManagedObject.Kind.VEHICLE)
            return super().save(*args, **kwargs)


class Service(models.Model):
    abbreviation = models.CharField(max_length=80, unique=True)

    class Meta:
        ordering = ["abbreviation"]

    def __str__(self) -> str:
        return self.abbreviation


class Location(models.Model):
    class Kind(models.TextChoices):
        POST = "post", "Post"
        BUILDING = "building", "Building"
        ROOM = "room", "Room"
        OTHER = "other", "Other"

    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children"
    )
    service = models.OneToOneField(
        Service,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="location",
    )

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class VectorStatus(models.Model):
    """CityGIS vehicle status reference values from the supplied table."""

    code = models.CharField(max_length=3, primary_key=True)
    description = models.CharField(max_length=120)
    abbreviation = models.CharField(max_length=30)
    color = models.CharField(max_length=7)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.description}"


class CityGISSyncState(models.Model):
    """Latest synchronization health, not a task-result or event-history record."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    last_succeeded_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "CityGIS synchronization state"
        verbose_name_plural = "CityGIS synchronization state"

    def __str__(self) -> str:
        return "CityGIS synchronization state"


class Vector(models.Model):
    """A dispatch resource record, kept separately from its physical vehicle."""

    managed_object = models.OneToOneField(
        ManagedObject, on_delete=models.CASCADE, related_name="vector"
    )

    vector_code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100, blank=True)
    abbreviation = models.CharField(max_length=100, blank=True)
    service_abbreviation = models.CharField(max_length=80, blank=True)
    service = models.ForeignKey(
        Service, null=True, blank=True, on_delete=models.SET_NULL, related_name="vectors"
    )
    resource_type_code = models.CharField(max_length=80, blank=True)
    resource_code = models.CharField(max_length=100, blank=True)
    operational_status_code = models.CharField(max_length=20, blank=True)
    status_updated_at = models.DateTimeField(null=True, blank=True)
    vehicle = models.OneToOneField(
        Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="vector"
    )
    source_vehicle_name = models.CharField(max_length=100, blank=True)
    is_current = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["service_abbreviation", "vector_code"]

    def __str__(self) -> str:
        return self.abbreviation or self.vector_code

    @property
    def post(self):
        if not self.service_id:
            return None
        location = getattr(self.service, "location", None)
        if location and location.kind == Location.Kind.POST:
            return location
        return None

    def save(self, *args, **kwargs):
        if self.managed_object_id:
            return super().save(*args, **kwargs)
        with transaction.atomic():
            self.managed_object = ManagedObject.objects.create(kind=ManagedObject.Kind.VECTOR)
            return super().save(*args, **kwargs)


class VectorServiceHistory(models.Model):
    vector = models.ForeignKey(Vector, on_delete=models.CASCADE, related_name="service_history")
    service = models.ForeignKey(
        Service, null=True, blank=True, on_delete=models.PROTECT, related_name="vector_history"
    )
    source_service_abbreviation = models.CharField(max_length=80, blank=True)
    source_effective_at = models.DateTimeField(null=True, blank=True)
    observed_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["observed_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["vector"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_vector_service_history",
            )
        ]


class VectorVehicleHistory(models.Model):
    vector = models.ForeignKey(Vector, on_delete=models.CASCADE, related_name="vehicle_history")
    vehicle = models.ForeignKey(
        Vehicle, null=True, blank=True, on_delete=models.PROTECT, related_name="vector_history"
    )
    source_vehicle_name = models.CharField(max_length=100, blank=True)
    source_effective_at = models.DateTimeField(null=True, blank=True)
    observed_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["observed_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["vector"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_vector_vehicle_history",
            )
        ]


class VectorStatusHistory(models.Model):
    """Observed operational status episodes for a CityGIS vector."""

    vector = models.ForeignKey(Vector, on_delete=models.CASCADE, related_name="status_history")
    status_code = models.CharField(max_length=20, blank=True)
    source_effective_at = models.DateTimeField(null=True, blank=True)
    observed_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-source_effective_at", "-observed_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["vector"],
                condition=Q(ended_at__isnull=True),
                name="uniq_active_vector_status_history",
            )
        ]
