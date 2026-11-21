from dataclasses import dataclass
from datetime import datetime

from django.db.models import Q

from citygis.models import Vector, VectorVehicleHistory, Vehicle


@dataclass(frozen=True)
class InventoryRelationship:
    vehicle: Vehicle | None
    vehicle_fireplan_id: int | None
    vector: Vector | None


def resolve_inventory_relationship(
    vehicle_alpha_code: str, closed_at: datetime
) -> InventoryRelationship:
    """Resolve only a unique exact vehicle match and its vector at close time."""
    matches = list(Vehicle.objects.filter(alphacode=vehicle_alpha_code).order_by("pk")[:2])
    if len(matches) != 1:
        return InventoryRelationship(vehicle=None, vehicle_fireplan_id=None, vector=None)

    vehicle = matches[0]
    history = (
        VectorVehicleHistory.objects.filter(
            vehicle=vehicle,
            observed_at__lte=closed_at,
        )
        .filter(Q(ended_at__isnull=True) | Q(ended_at__gt=closed_at))
        .select_related("vector")
        .order_by("-observed_at", "-id")
        .first()
    )
    return InventoryRelationship(
        vehicle=vehicle,
        vehicle_fireplan_id=vehicle.fireplan_id,
        vector=history.vector if history else None,
    )
