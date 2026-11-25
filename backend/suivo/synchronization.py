from datetime import datetime
from urllib.parse import urlsplit

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import SuivoDevice, SuivoUnit


def _identifier(value) -> str:
    if isinstance(value, dict):
        value = value.get("@id") or value.get("id")
    if not isinstance(value, str | int) or isinstance(value, bool) or not str(value).strip():
        raise ValueError("Suivo record is missing a stable source identifier.")
    return str(value).strip()


def _datetime(value) -> datetime | None:
    if not isinstance(value, str):
        return None
    result = parse_datetime(value)
    if result and timezone.is_naive(result):
        result = timezone.make_aware(result)
    return result


def _unit_key(value) -> str | None:
    if value in (None, ""):
        return None
    key = _identifier(value)
    return urlsplit(key).path.rstrip("/").split("/")[-1]


@transaction.atomic
def synchronize_suivo_snapshot(units: list[dict], devices: list[dict], statuses: list[dict]):
    """Atomically upsert a complete API response; omitted rows are retained."""
    unit_map = {}
    for row in units:
        external_id = _identifier(row.get("@id"))
        name = row.get("name")
        if not isinstance(name, str):
            raise ValueError("Suivo unit is missing a valid name.")
        unit_map[external_id] = SuivoUnit.objects.update_or_create(
            external_id=external_id,
            defaults={"name": name, "data": row, "source_updated_at": timezone.now()},
        )[0]
        unit_map[urlsplit(external_id).path.rstrip("/").split("/")[-1]] = unit_map[external_id]

    for row in statuses:
        key = _unit_key(row.get("unit"))
        unit = unit_map.get(key) or SuivoUnit.objects.filter(external_id=key).first()
        if not unit:
            continue
        last_position = row.get("last-position")
        position_at = None
        position = None
        if isinstance(last_position, dict):
            position = last_position
            position_at = _datetime(
                last_position.get("@time-indicator")
                or last_position.get("time")
                or last_position.get("timestamp")
            )
        unit.last_seen_at = _datetime(row.get("last-seen"))
        unit.position_at = position_at
        unit.position = position
        unit.status_data = row
        unit.source_updated_at = timezone.now()
        unit.save(
            update_fields=[
                "last_seen_at",
                "position_at",
                "position",
                "status_data",
                "source_updated_at",
            ]
        )

    for row in devices:
        imei = row.get("@imei") or row.get("imei")
        external_id = _identifier(row.get("@id") or row.get("id") or imei)
        unit_key = _unit_key(row.get("unit"))
        unit = unit_map.get(unit_key) or SuivoUnit.objects.filter(external_id=unit_key).first()
        SuivoDevice.objects.update_or_create(
            external_id=external_id,
            defaults={
                "imei": str(imei or ""),
                "device_type": str(row.get("type") or ""),
                "unit": unit,
                "data": row,
                "source_updated_at": timezone.now(),
            },
        )

    return {"units": len(units), "devices": len(devices), "statuses": len(statuses)}
