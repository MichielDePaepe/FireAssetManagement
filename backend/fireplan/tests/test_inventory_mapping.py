from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from fireplan.inventory_mapping import (
    extract_mapped_items,
    load_inventory_mapping,
    parse_fireplan_datetime,
    resolve_mapped_container_id,
)


def test_yaml_mapping_extracts_items_from_runtime_container_uuid_and_preserves_tei():
    mapping = load_inventory_mapping()
    tree = {
        "records": [
            {"id": "container-other", "nameFr": "Cabine sanitaire"},
            {"id": "container-this-inventory", "nameFr": "Cabine de conduite"},
        ]
    }

    assert resolve_mapped_container_id(tree, mapping) == "container-this-inventory"
    extracted = extract_mapped_items(
        tree,
        [
            {
                "id": "item-1",
                "itemTypeId": 1010,
                "itemTypeName": "Radio portable Astrid",
                "trackedItemSerialNumber": "0000123405",
            },
        ],
        mapping,
    )

    assert extracted == [
        {
            "fireplan_item_id": "item-1",
            "item_type_id": 1010,
            "item_type_name": "Radio portable Astrid",
            "serial_number": "0000123405",
        }
    ]


def test_yaml_mapping_uses_cabin_name_and_radio_type_id():
    mapping = load_inventory_mapping()

    assert mapping["container_name_fr"] == "Cabine de conduite"
    assert mapping["item_type_id"] == 1010
    assert mapping["item_type_name"] == "Radio portable Astrid"


def test_extraction_ignores_other_item_types_and_raises_when_cabin_is_missing():
    tree = {"records": [{"id": "cab", "nameFr": "Cabine de conduite"}]}
    mapping = load_inventory_mapping()

    assert extract_mapped_items(
        tree,
        [
            {
                "containerId": "cab",
                "id": "item-other",
                "itemTypeId": 999,
                "itemTypeName": "Other",
                "trackedItemSerialNumber": "123",
            }
        ],
        mapping,
    ) == []

    with pytest.raises(ValueError, match="Cabine de conduite"):
        resolve_mapped_container_id({"records": []}, mapping)


def test_extraction_checks_radio_type_name_after_matching_type_id():
    with pytest.raises(ValueError, match="benaming is gewijzigd"):
        extract_mapped_items(
            {"records": [{"id": "cab", "nameFr": "Cabine de conduite"}]},
            [
                {
                    "id": "item-1",
                    "itemTypeId": 1010,
                    "itemTypeName": "Different source name",
                    "trackedItemSerialNumber": "00123",
                }
            ],
            load_inventory_mapping(),
        )


def test_naive_fireplan_datetime_uses_brussels_timezone():
    parsed = parse_fireplan_datetime("2026-11-21 12:34:56")

    assert parsed == datetime(2026, 11, 21, 12, 34, 56, tzinfo=ZoneInfo("Europe/Brussels"))
    assert parsed.utcoffset() == timedelta(hours=1)


def test_explicit_fireplan_datetime_offset_is_preserved():
    parsed = parse_fireplan_datetime("2026-06-01T12:34:56+02:00")

    assert parsed == datetime(2026, 6, 1, 12, 34, 56, tzinfo=timezone(timedelta(hours=2)))
