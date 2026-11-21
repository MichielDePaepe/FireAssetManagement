from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yaml

_BRUSSELS = ZoneInfo("Europe/Brussels")
_DEFAULT_MAPPING_PATH = Path(__file__).with_name("inventory_mapping.yaml")


def load_inventory_mapping(path: Path | None = None) -> dict[str, Any]:
    """Load the small, staff-maintained Fireplan inventory extraction mapping."""
    with (path or _DEFAULT_MAPPING_PATH).open(encoding="utf-8") as mapping_file:
        mapping = yaml.safe_load(mapping_file)

    if not isinstance(mapping, dict):
        raise ValueError("Fireplan-inventarismapping moet een YAML-object zijn.")
    if (
        not isinstance(mapping.get("version"), int)
        or not isinstance(mapping.get("container_name_fr"), str)
        or not isinstance(mapping.get("item_type_id"), int)
        or not isinstance(mapping.get("item_type_name"), str)
    ):
        raise ValueError("Fireplan-inventarismapping mist verplichte velden.")
    return mapping


def resolve_mapped_container_id(
    container_tree: dict[str, Any], mapping: dict[str, Any]
) -> str:
    """Resolve the mapped container from the current inventory's tree."""
    records = container_tree.get("records")
    if not isinstance(records, list):
        raise ValueError("Fireplan-containerboom bevat geen records-lijst.")

    matches = [
        record
        for record in records
        if isinstance(record, dict) and record.get("nameFr") == mapping["container_name_fr"]
    ]
    if len(matches) != 1:
        raise ValueError(
            f"Verwacht precies één container met naam {mapping['container_name_fr']!r}; "
            f"gevonden: {len(matches)}."
        )
    container_id = matches[0].get("id")
    if not isinstance(container_id, str) or not container_id:
        raise ValueError("De geselecteerde Fireplan-container heeft geen geldige UUID.")
    return container_id


def extract_mapped_items(
    container_tree: dict[str, Any],
    item_records: list[dict[str, Any]],
    mapping: dict[str, Any],
) -> list[dict[str, Any]]:
    """Select radios from an item response fetched with the resolved container UUID."""
    resolve_mapped_container_id(container_tree, mapping)
    selected = []
    for item in item_records:
        if item.get("itemTypeId") != mapping["item_type_id"]:
            continue
        if item.get("itemTypeName") != mapping["item_type_name"]:
            raise ValueError(
                "Fireplan itemTypeId komt overeen, maar de itemtypebenaming is gewijzigd."
            )
        item_id = item.get("id")
        serial_number = item.get("trackedItemSerialNumber")
        if not isinstance(item_id, str | int) or isinstance(item_id, bool):
            raise ValueError("Geselecteerd Fireplan-item heeft geen geldig ID.")
        if not isinstance(serial_number, str):
            raise ValueError("TEI van een geselecteerd Fireplan-item is geen tekst.")
        selected.append(
            {
                "fireplan_item_id": str(item_id),
                "item_type_id": mapping["item_type_id"],
                "item_type_name": mapping["item_type_name"],
                "serial_number": serial_number,
            }
        )
    return selected


def parse_fireplan_datetime(value: str) -> datetime:
    """Parse a Fireplan datetime, assigning Brussels time only when no offset exists."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=_BRUSSELS)
    return parsed
