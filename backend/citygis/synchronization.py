import logging
import re
from datetime import UTC, datetime

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import (
    Service,
    Vector,
    VectorServiceHistory,
    VectorStatusHistory,
    VectorVehicleHistory,
    Vehicle,
)

logger = logging.getLogger(__name__)


class CityGISSyncPayloadError(ValueError):
    """Raised when a complete source snapshot cannot be reconciled safely."""


def _text(value) -> str:
    return str(value).strip() if value is not None else ""


def _status_datetime(value):
    raw = _text(value)
    if not raw:
        return None
    raw = re.sub(r":(\d{6})\d(?=[AP]M$)", r":\1", raw)
    try:
        parsed = datetime.strptime(raw, "%b %d %Y %I:%M:%S:%f%p")
    except ValueError:
        parsed = parse_datetime(raw)
    if parsed is None:
        raise CityGISSyncPayloadError("Resourcesdienst gaf een ongeldige LastStatusTimeUpdated.")
    if timezone.is_naive(parsed):
        # The resources service omits an offset; its status timestamps are UTC.
        parsed = timezone.make_aware(parsed, UTC)
    return parsed


def _vehicle_values(row: dict) -> dict:
    if not isinstance(row, dict):
        raise CityGISSyncPayloadError("Fireplan gaf een ongeldig voertuigrecord terug.")
    fireplan_id = row.get("id")
    alpha = _text(row.get("alphacode"))
    if (
        isinstance(fireplan_id, bool)
        or not isinstance(fireplan_id, int)
        or fireplan_id <= 0
        or not alpha
    ):
        raise CityGISSyncPayloadError(
            "Fireplan gaf een voertuig zonder geldig ID of alphacode terug."
        )
    return {
        "fireplan_id": fireplan_id,
        "alphacode": alpha,
        "plate": _text(row.get("plate")),
        "utilisation": _text(row.get("utilisation")),
        "chassis": _text(row.get("chassis")),
        "fleet_status": _text(row.get("statut")),
    }


def _vector_values(row: dict) -> dict:
    if not isinstance(row, dict):
        raise CityGISSyncPayloadError("Resourcesdienst gaf een ongeldig vectorrecord terug.")
    vector_code = _text(row.get("pResourceCode"))
    source_name = row.get("Name")
    raw_status = row.get("StatusCode")
    if not vector_code or (source_name is not None and not isinstance(source_name, str)):
        raise CityGISSyncPayloadError(
            "Resourcesdienst gaf een vectorrecord zonder geldige pResourceCode of Name terug."
        )
    status_is_valid = (
        not isinstance(raw_status, bool)
        and isinstance(raw_status, str | int)
        and bool(str(raw_status).strip())
    )
    if not status_is_valid:
        logger.error(
            "CityGIS vector has no valid operational status code",
            extra={
                "vector_code": vector_code,
                "status_code_type": type(raw_status).__name__,
            },
        )
    return {
        "vector_code": vector_code,
        "name": _text(row.get("pName")),
        "abbreviation": _text(row.get("pAbbreviation")),
        "service_abbreviation": _text(row.get("pServiceAbbreviation")),
        "resource_type_code": _text(row.get("pResourceTypeCode")),
        "resource_code": _text(row.get("ResourceCode")),
        "operational_status_code": str(raw_status) if status_is_valid else "",
        "status_updated_at": _status_datetime(row.get("LastStatusTimeUpdated")),
        "source_vehicle_name": _text(source_name),
    }


def _normalised_name(value: str) -> str:
    return value.strip().casefold()


def _validate_unique_records(vehicle_values: list[dict], vector_values: list[dict]) -> None:
    vehicle_ids = [row["fireplan_id"] for row in vehicle_values]
    if len(vehicle_ids) != len(set(vehicle_ids)):
        raise CityGISSyncPayloadError("Fireplan-snapshot bevat dubbele voertuig-ID's.")
    vector_codes = [row["vector_code"] for row in vector_values]
    if len(vector_codes) != len(set(vector_codes)):
        raise CityGISSyncPayloadError("Resourcesnapshot bevat dubbele pResourceCode-waarden.")


def _record_relationship_history(
    history_model,
    *,
    vector: Vector,
    target_field: str,
    target,
    source_field: str,
    source_value: str,
    observed_at,
) -> None:
    current = (
        history_model.objects.select_for_update()
        .filter(vector=vector, ended_at__isnull=True)
        .first()
    )
    target_id = target.pk if target else None
    if (
        current
        and getattr(current, f"{target_field}_id") == target_id
        and getattr(current, source_field) == source_value
    ):
        return
    if current:
        current.ended_at = observed_at
        current.save(update_fields=["ended_at"])
    # The live resources payload only provides LastStatusTimeUpdated. That is
    # a status timestamp, not an effective time for service/vehicle changes.
    history_model.objects.create(
        vector=vector,
        **{
            target_field: target,
            source_field: source_value,
            "observed_at": observed_at,
            "source_effective_at": None,
        },
    )


def _record_status_history(
    *, vector: Vector, status_code: str, source_effective_at, observed_at
) -> None:
    current = (
        VectorStatusHistory.objects.select_for_update()
        .filter(vector=vector, ended_at__isnull=True)
        .first()
    )
    if (
        current
        and current.status_code == status_code
        and current.source_effective_at == source_effective_at
    ):
        return
    if current:
        transition_at = source_effective_at or observed_at
        if current.source_effective_at and transition_at < current.source_effective_at:
            logger.warning(
                "CityGIS status timestamp moved backwards",
                extra={"vector_code": vector.vector_code, "status_code": status_code},
            )
            transition_at = current.source_effective_at
        current.ended_at = transition_at
        current.save(update_fields=["ended_at"])
    VectorStatusHistory.objects.create(
        vector=vector,
        status_code=status_code,
        source_effective_at=source_effective_at,
        observed_at=observed_at,
    )


@transaction.atomic
def synchronize_citygis_data(vehicle_rows: list[dict], vector_rows: list[dict]) -> dict[str, int]:
    """Apply complete validated source snapshots and rebuild their derived links."""
    if not isinstance(vehicle_rows, list) or not isinstance(vector_rows, list):
        raise CityGISSyncPayloadError("CityGIS-bronnen moeten volledige lijsten teruggeven.")

    # Validate both complete snapshots before issuing any database writes.
    vehicles = [_vehicle_values(row) for row in vehicle_rows]
    vectors = [_vector_values(row) for row in vector_rows]
    _validate_unique_records(vehicles, vectors)

    now = timezone.now()
    vehicles_by_alpha: dict[str, Vehicle] = {}
    vehicle_ids_by_alpha: dict[str, int] = {}
    vehicles_added = vehicles_updated = 0
    seen_vehicle_ids = {row["fireplan_id"] for row in vehicles}

    for values in vehicles:
        fireplan_id = values["fireplan_id"]
        alpha_key = _normalised_name(values["alphacode"])
        vehicle, created = Vehicle.objects.update_or_create(
            fireplan_id=fireplan_id,
            defaults={**values, "is_current": True, "last_seen_at": now},
        )
        existing_vehicle = vehicles_by_alpha.get(alpha_key)
        if existing_vehicle is None:
            vehicles_by_alpha[alpha_key] = vehicle
            vehicle_ids_by_alpha[alpha_key] = fireplan_id
        else:
            logger.error(
                "Duplicate Fireplan alphacode in CityGIS snapshot",
                extra={
                    "alphacode": values["alphacode"],
                    "first_fireplan_id": vehicle_ids_by_alpha[alpha_key],
                    "duplicate_fireplan_id": fireplan_id,
                },
            )
        if created:
            vehicles_added += 1
        else:
            vehicles_updated += 1

    seen_vector_codes = {row["vector_code"] for row in vectors}
    services = {service.abbreviation: service for service in Service.objects.all()}
    for abbreviation in {row["service_abbreviation"] for row in vectors} - {""}:
        if abbreviation not in services:
            services[abbreviation] = Service.objects.get_or_create(abbreviation=abbreviation)[0]
    # Rebuild derived one-to-one links from the complete snapshot. Clearing them
    # first lets a newly earlier source record take over an existing association.
    Vector.objects.exclude(vehicle=None).update(vehicle=None)
    vectors_added = vectors_updated = duplicate_vector_matches = 0
    claimed_vehicle_ids: set[int] = set()

    for values in vectors:
        alpha_key = _normalised_name(values["source_vehicle_name"])
        vehicle = vehicles_by_alpha.get(alpha_key)
        if vehicle and vehicle.pk in claimed_vehicle_ids:
            logger.error(
                "Multiple CityGIS vectors match one Fireplan vehicle",
                extra={
                    "fireplan_id": vehicle.fireplan_id,
                    "alphacode": vehicle.alphacode,
                    "vector_code": values["vector_code"],
                    "source_vehicle_name": values["source_vehicle_name"],
                },
            )
            vehicle = None
            duplicate_vector_matches += 1
        elif vehicle:
            claimed_vehicle_ids.add(vehicle.pk)

        vector, created = Vector.objects.update_or_create(
            vector_code=values["vector_code"],
            defaults={
                **values,
                "service": services.get(values["service_abbreviation"]),
                "vehicle": vehicle,
                "is_current": True,
                "last_seen_at": now,
            },
        )
        _record_relationship_history(
            VectorServiceHistory,
            vector=vector,
            target_field="service",
            target=services.get(values["service_abbreviation"]),
            source_field="source_service_abbreviation",
            source_value=values["service_abbreviation"],
            observed_at=now,
        )
        _record_relationship_history(
            VectorVehicleHistory,
            vector=vector,
            target_field="vehicle",
            target=vehicle,
            source_field="source_vehicle_name",
            source_value=values["source_vehicle_name"],
            observed_at=now,
        )
        _record_status_history(
            vector=vector,
            status_code=values["operational_status_code"],
            source_effective_at=values["status_updated_at"],
            observed_at=now,
        )
        if created:
            vectors_added += 1
        else:
            vectors_updated += 1

    vehicles_missing = (
        Vehicle.objects.exclude(fireplan_id__in=seen_vehicle_ids)
        .filter(is_current=True)
        .update(is_current=False)
    )
    vectors_missing = (
        Vector.objects.exclude(vector_code__in=seen_vector_codes)
        .filter(is_current=True)
        .update(is_current=False)
    )

    return {
        "vehicles_added": vehicles_added,
        "vehicles_updated": vehicles_updated,
        "vehicles_missing": vehicles_missing,
        "vectors_added": vectors_added,
        "vectors_updated": vectors_updated,
        "vectors_missing": vectors_missing,
        "duplicate_vector_matches": duplicate_vector_matches,
    }
