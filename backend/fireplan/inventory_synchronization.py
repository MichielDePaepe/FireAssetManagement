from collections.abc import Callable
from datetime import date

from django.db import transaction
from django.utils import timezone

from .client import FireplanInventoryError
from .inventory_mapping import parse_fireplan_datetime
from .inventory_relationships import resolve_inventory_relationship
from .models import FireplanInventory, FireplanRadioObservation


def _optional_text(record: dict, field: str) -> str:
    value = record.get(field)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise FireplanInventoryError(f"Fireplan gaf een ongeldig inventarisrecordveld {field}.")
    return value


def _optional_bool(record: dict, field: str) -> bool | None:
    value = record.get(field)
    if value is not None and not isinstance(value, bool):
        raise FireplanInventoryError(f"Fireplan gaf een ongeldig inventarisrecordveld {field}.")
    return value


def _optional_count(record: dict, field: str) -> int | None:
    value = record.get(field)
    if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
        raise FireplanInventoryError(f"Fireplan gaf een ongeldig inventarisrecordveld {field}.")
    return value


def _inventory_defaults(record: dict) -> dict:
    inventory_uuid = record.get("uuid")
    closed_at_raw = record.get("closedAt")
    if not isinstance(inventory_uuid, str) or not inventory_uuid.strip():
        raise FireplanInventoryError("Fireplan gaf een inventarisrecord zonder geldige UUID.")
    if not isinstance(closed_at_raw, str):
        raise FireplanInventoryError("Fireplan gaf een inventarisrecord zonder geldige closedAt.")
    try:
        closed_at = parse_fireplan_datetime(closed_at_raw)
        created_at = (
            parse_fireplan_datetime(record["createdAt"]) if record.get("createdAt") else None
        )
        updated_at = (
            parse_fireplan_datetime(record["updatedAt"]) if record.get("updatedAt") else None
        )
    except (TypeError, ValueError) as error:
        raise FireplanInventoryError("Fireplan gaf ongeldige inventarisdatums terug.") from error

    alpha_code = _optional_text(record, "vehicleAlphaCode")
    relationship = resolve_inventory_relationship(alpha_code, closed_at) if alpha_code else None
    return {
        "vehicle_alpha_code": alpha_code,
        "vehicle": relationship.vehicle if relationship else None,
        "vehicle_fireplan_id": relationship.vehicle_fireplan_id if relationship else None,
        "vector": relationship.vector if relationship else None,
        "inventory_type_name": _optional_text(record, "inventoryTypeName"),
        "done_in_name": _optional_text(record, "doneInName"),
        "done_by_full_name": _optional_text(record, "doneByFullName"),
        "overseen_by_full_name": _optional_text(record, "overseenByFullName"),
        "source_created_at": created_at,
        "source_closed_at": closed_at,
        "source_updated_at": updated_at,
        "has_incident_reports": _optional_bool(record, "hasIncidentReports"),
        "is_complete_after_completion": _optional_bool(record, "isCompleteAfterCompletion"),
        "is_complete_before_completion": _optional_bool(record, "isCompleteBeforeCompletion"),
        "is_quantity_count_excluded": _optional_bool(record, "isQuantityCountExcluded"),
        "is_test_standard": _optional_bool(record, "isTestStandard"),
        "remaining_missing_followed_count": _optional_count(
            record, "remainingMissingFollowedCount"
        ),
    }


def _validate_radio_items(items: object) -> list[dict]:
    if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
        raise FireplanInventoryError("Fireplan gaf ongeldige geselecteerde radio-items terug.")
    item_ids = [item.get("fireplan_item_id") for item in items]
    if any(not isinstance(item_id, str) or not item_id for item_id in item_ids):
        raise FireplanInventoryError("Fireplan gaf een radio-item zonder geldig item-ID terug.")
    if len(item_ids) != len(set(item_ids)):
        raise FireplanInventoryError("Fireplan gaf dubbele radio-item-ID's terug.")
    for item in items:
        if (
            isinstance(item.get("item_type_id"), bool)
            or not isinstance(item.get("item_type_id"), int)
            or not isinstance(item.get("item_type_name"), str)
            or not isinstance(item.get("serial_number"), str)
        ):
            raise FireplanInventoryError("Fireplan gaf ongeldige radio-itemvelden terug.")
    return items


def synchronize_fireplan_inventories(
    client,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    force: bool = False,
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> dict:
    """Synchronize source summaries and selectively process their radio details."""
    if (start_date is None) != (end_date is None):
        raise ValueError("Begindatum en einddatum moeten samen zijn opgegeven.")
    if start_date and end_date and start_date > end_date:
        raise ValueError("Begindatum mag niet na einddatum liggen.")

    summaries = client.fetch_inventory_summaries(
        start_date=start_date,
        end_date=end_date,
    )
    mapping_version = client.mapping["version"]
    result = {"added": 0, "updated": 0, "skipped": 0, "failed": 0, "errors": []}
    if not summaries:
        if progress_callback:
            progress_callback(0, 1, "Geen FirePlan-inventarissen gevonden")
        return result

    for index, summary in enumerate(summaries, start=1):
        try:
            defaults = _inventory_defaults(summary)
            inventory, created = FireplanInventory.objects.update_or_create(
                uuid=summary["uuid"], defaults=defaults
            )
        except (FireplanInventoryError, KeyError, TypeError) as error:
            result["failed"] += 1
            result["errors"].append({"uuid": summary.get("uuid", ""), "error": str(error)[:500]})
            if progress_callback:
                progress_callback(index, len(summaries), "Ongeldig FirePlan-inventarisrecord")
            continue

        if created:
            result["added"] += 1

        needs_details = (
            force
            or created
            or inventory.mapping_version != mapping_version
            or inventory.sync_status
            in {
                FireplanInventory.SyncStatus.PENDING,
                FireplanInventory.SyncStatus.RUNNING,
                FireplanInventory.SyncStatus.FAILED,
            }
            or inventory.last_successful_sync_at is None
        )
        if not needs_details:
            result["skipped"] += 1
            if progress_callback:
                progress_callback(index, len(summaries), "Inventaris is actueel voor de mapping")
            continue

        attempted_at = timezone.now()
        inventory.sync_status = FireplanInventory.SyncStatus.RUNNING
        inventory.last_attempted_at = attempted_at
        inventory.save(update_fields=["sync_status", "last_attempted_at", "updated_at"])

        try:
            radio_items = _validate_radio_items(client.fetch_inventory_radio_items(inventory.uuid))
        except (FireplanInventoryError, ValueError) as error:
            inventory.sync_status = FireplanInventory.SyncStatus.FAILED
            inventory.last_error = str(error)[:500]
            inventory.save(update_fields=["sync_status", "last_error", "updated_at"])
            result["failed"] += 1
            result["errors"].append({"uuid": inventory.uuid, "error": inventory.last_error})
            if progress_callback:
                progress_callback(
                    index, len(summaries), "Inventarisdetails konden niet worden verwerkt"
                )
            continue

        with transaction.atomic():
            inventory = FireplanInventory.objects.select_for_update().get(pk=inventory.pk)
            inventory.radio_observations.all().delete()
            FireplanRadioObservation.objects.bulk_create(
                [
                    FireplanRadioObservation(
                        inventory=inventory,
                        fireplan_item_id=item["fireplan_item_id"],
                        item_type_id=item["item_type_id"],
                        serial_number=item["serial_number"],
                    )
                    for item in radio_items
                ]
            )
            inventory.radio_items = radio_items
            inventory.mapping_version = mapping_version
            inventory.sync_status = FireplanInventory.SyncStatus.SYNCED
            inventory.last_successful_sync_at = timezone.now()
            inventory.last_error = ""
            inventory.save(
                update_fields=[
                    "radio_items",
                    "mapping_version",
                    "sync_status",
                    "last_successful_sync_at",
                    "last_error",
                    "updated_at",
                ]
            )
        if not created:
            result["updated"] += 1
        if progress_callback:
            progress_callback(index, len(summaries), "Inventarisradio's verwerkt")

    return result
