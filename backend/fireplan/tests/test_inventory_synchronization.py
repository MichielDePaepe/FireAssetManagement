from datetime import UTC, date, datetime

import pytest

from citygis.models import Vector, VectorVehicleHistory, Vehicle
from fireplan.client import FireplanInventoryError
from fireplan.inventory_synchronization import synchronize_fireplan_inventories
from fireplan.models import FireplanInventory, FireplanRadioObservation

pytestmark = pytest.mark.django_db


def summary(uuid: str = "inv-1", closed_at: str = "2026-11-20 09:00:00") -> dict:
    return {
        "uuid": uuid,
        "vehicleAlphaCode": "NO-MATCH",
        "inventoryTypeName": "Inventory close",
        "doneInName": "Post A",
        "doneByFullName": "Operator",
        "overseenByFullName": "Supervisor",
        "closedAt": closed_at,
        "createdAt": "2026-11-20 08:00:00",
        "updatedAt": "2026-11-20 09:00:00",
        "hasIncidentReports": False,
        "isCompleteAfterCompletion": True,
        "isCompleteBeforeCompletion": False,
        "isQuantityCountExcluded": False,
        "isTestStandard": False,
        "remainingMissingFollowedCount": 0,
    }


class FakeClient:
    def __init__(self, records=None, radio_items=None):
        self.records = records or [summary()]
        self.radio_items = radio_items or [
            {
                "fireplan_item_id": "item-1",
                "item_type_id": 1010,
                "item_type_name": "Radio portable Astrid",
                "serial_number": "00001234",
            }
        ]
        self.mapping = {"version": 1}
        self.detail_calls = []
        self.fetch_error = None
        self.period = None

    def fetch_inventory_summaries(self, *, start_date=None, end_date=None):
        self.period = (start_date, end_date)
        if (start_date, end_date) == (None, None):
            return self.records
        return [
            record
            for record in self.records
            if start_date <= datetime.fromisoformat(record["closedAt"]).date() <= end_date
        ]

    def fetch_inventory_radio_items(self, inventory_uuid):
        self.detail_calls.append(inventory_uuid)
        if self.fetch_error:
            raise self.fetch_error
        return self.radio_items


def test_sync_processes_new_inventory_once_and_skips_same_mapping_on_next_run():
    client = FakeClient()

    first = synchronize_fireplan_inventories(client)
    second = synchronize_fireplan_inventories(client)

    inventory = FireplanInventory.objects.get(uuid="inv-1")
    assert first == {"added": 1, "updated": 0, "skipped": 0, "failed": 0, "errors": []}
    assert second == {"added": 0, "updated": 0, "skipped": 1, "failed": 0, "errors": []}
    assert client.detail_calls == ["inv-1"]
    assert inventory.radio_items[0]["serial_number"] == "00001234"
    assert inventory.sync_status == FireplanInventory.SyncStatus.SYNCED
    assert inventory.mapping_version == 1
    assert FireplanRadioObservation.objects.filter(inventory=inventory).count() == 1


def test_sync_refetches_and_replaces_observations_when_mapping_version_changes():
    client = FakeClient()
    synchronize_fireplan_inventories(client)
    inventory = FireplanInventory.objects.get(uuid="inv-1")
    old_success = inventory.last_successful_sync_at
    client.mapping = {"version": 2}
    client.radio_items = [
        {
            "fireplan_item_id": "item-2",
            "item_type_id": 1010,
            "item_type_name": "Radio portable Astrid",
            "serial_number": "00009999",
        }
    ]

    result = synchronize_fireplan_inventories(client)

    inventory.refresh_from_db()
    assert result["updated"] == 1
    assert client.detail_calls == ["inv-1", "inv-1"]
    assert inventory.mapping_version == 2
    assert inventory.last_successful_sync_at >= old_success
    assert list(inventory.radio_observations.values_list("fireplan_item_id", flat=True)) == [
        "item-2"
    ]


def test_failed_detail_fetch_keeps_last_successful_json_observations_and_time():
    client = FakeClient()
    synchronize_fireplan_inventories(client)
    inventory = FireplanInventory.objects.get(uuid="inv-1")
    old_json = inventory.radio_items
    old_success = inventory.last_successful_sync_at
    client.mapping = {"version": 2}
    client.fetch_error = FireplanInventoryError("source temporarily unavailable")

    result = synchronize_fireplan_inventories(client)

    inventory.refresh_from_db()
    assert result["failed"] == 1
    assert inventory.sync_status == FireplanInventory.SyncStatus.FAILED
    assert inventory.radio_items == old_json
    assert inventory.last_successful_sync_at == old_success
    assert inventory.last_error == "source temporarily unavailable"
    assert list(inventory.radio_observations.values_list("fireplan_item_id", flat=True)) == [
        "item-1"
    ]


def test_failed_targeted_sync_keeps_full_successful_snapshot_and_relationships():
    client = FakeClient()
    synchronize_fireplan_inventories(client)
    inventory = FireplanInventory.objects.get(uuid="inv-1")
    vehicle = Vehicle.objects.create(fireplan_id=9002, alphacode="SAVED-CODE")
    vector = Vector.objects.create(vector_code="SAVED-VECTOR", vehicle=vehicle)
    inventory.vehicle = vehicle
    inventory.vehicle_fireplan_id = vehicle.fireplan_id
    inventory.vector = vector
    inventory.inventory_type_name = "Saved type"
    inventory.done_in_name = "Saved post"
    inventory.save()
    original_snapshot = {
        "vehicle_alpha_code": inventory.vehicle_alpha_code,
        "vehicle_id": inventory.vehicle_id,
        "vehicle_fireplan_id": inventory.vehicle_fireplan_id,
        "vector_id": inventory.vector_id,
        "inventory_type_name": inventory.inventory_type_name,
        "done_in_name": inventory.done_in_name,
        "source_closed_at": inventory.source_closed_at,
        "radio_items": inventory.radio_items,
        "last_successful_sync_at": inventory.last_successful_sync_at,
    }
    client.records[0]["vehicleAlphaCode"] = "CHANGED-CODE"
    client.records[0]["inventoryTypeName"] = "Changed type"
    client.records[0]["doneInName"] = "Changed post"
    client.fetch_error = FireplanInventoryError("source temporarily unavailable")

    result = synchronize_fireplan_inventories(
        client, inventory_uuid="inv-1", force=True
    )

    inventory.refresh_from_db()
    assert result["failed"] == 1
    assert inventory.sync_status == FireplanInventory.SyncStatus.FAILED
    assert inventory.last_error == "source temporarily unavailable"
    assert {
        "vehicle_alpha_code": inventory.vehicle_alpha_code,
        "vehicle_id": inventory.vehicle_id,
        "vehicle_fireplan_id": inventory.vehicle_fireplan_id,
        "vector_id": inventory.vector_id,
        "inventory_type_name": inventory.inventory_type_name,
        "done_in_name": inventory.done_in_name,
        "source_closed_at": inventory.source_closed_at,
        "radio_items": inventory.radio_items,
        "last_successful_sync_at": inventory.last_successful_sync_at,
    } == original_snapshot


def test_targeted_sync_processes_only_matching_inventory_uuid():
    client = FakeClient(records=[summary("selected"), summary("other")])
    inventory = FireplanInventory.objects.create(
        uuid="selected",
        inventory_type_name="Old type",
        done_in_name="Old post",
        radio_items=[{"fireplan_item_id": "old", "serial_number": "00000001"}],
        sync_status=FireplanInventory.SyncStatus.SYNCED,
        last_successful_sync_at=datetime(2026, 11, 20, 10, tzinfo=UTC),
    )
    vehicle = Vehicle.objects.create(fireplan_id=9010, alphacode="NO-MATCH")
    vector = Vector.objects.create(vector_code="TARGET-HISTORY")
    VectorVehicleHistory.objects.create(
        vector=vector,
        vehicle=vehicle,
        observed_at=datetime(2026, 11, 20, 7, 59, tzinfo=UTC),
    )
    client.records[0]["inventoryTypeName"] = "Updated type"
    client.records[0]["doneInName"] = "Updated post"

    result = synchronize_fireplan_inventories(
        client, inventory_uuid="selected", force=True
    )

    inventory.refresh_from_db()
    assert client.detail_calls == ["selected"]
    assert result == {"added": 0, "updated": 1, "skipped": 0, "failed": 0, "errors": []}
    assert inventory.inventory_type_name == "Updated type"
    assert inventory.done_in_name == "Updated post"
    assert inventory.vehicle == vehicle
    assert inventory.vector == vector
    assert inventory.radio_items[0]["serial_number"] == "00001234"
    assert FireplanInventory.objects.filter(uuid="selected").exists()
    assert not FireplanInventory.objects.filter(uuid="other").exists()


def test_targeted_sync_records_invalid_source_metadata_failure_without_mutating_snapshot():
    client = FakeClient()
    synchronize_fireplan_inventories(client)
    inventory = FireplanInventory.objects.get(uuid="inv-1")
    old_type = inventory.inventory_type_name
    old_closed_at = inventory.source_closed_at
    client.records[0]["closedAt"] = "invalid"

    result = synchronize_fireplan_inventories(client, inventory_uuid="inv-1", force=True)

    inventory.refresh_from_db()
    assert result["failed"] == 1
    assert inventory.sync_status == FireplanInventory.SyncStatus.FAILED
    assert inventory.last_error == "Fireplan gaf ongeldige inventarisdatums terug."
    assert inventory.last_attempted_at is not None
    assert inventory.inventory_type_name == old_type
    assert inventory.source_closed_at == old_closed_at


def test_forced_period_refetches_every_inventory_inclusive_local_date_range():
    client = FakeClient(
        records=[
            summary("start", "2026-11-20 00:00:00"),
            summary("end", "2026-11-20 23:59:59"),
            summary("outside", "2026-11-21 00:00:00"),
        ]
    )

    result = synchronize_fireplan_inventories(
        client,
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 20),
        force=True,
    )

    assert client.period == (date(2026, 11, 20), date(2026, 11, 20))
    assert client.detail_calls == ["start", "end"]
    assert result == {"added": 2, "updated": 0, "skipped": 0, "failed": 0, "errors": []}
    assert not FireplanInventory.objects.filter(uuid="outside").exists()


def test_forced_period_recalculates_historical_vehicle_and_vector_link():
    client = FakeClient(records=[summary()])
    synchronize_fireplan_inventories(client)
    inventory = FireplanInventory.objects.get(uuid="inv-1")
    assert inventory.vehicle is None

    vehicle = Vehicle.objects.create(fireplan_id=9001, alphacode="NO-MATCH")
    vector = Vector.objects.create(vector_code="HIST-VECTOR")
    VectorVehicleHistory.objects.create(
        vector=vector,
        vehicle=vehicle,
        observed_at=datetime(2026, 11, 20, 8, tzinfo=UTC),
    )

    synchronize_fireplan_inventories(
        client,
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 20),
        force=True,
    )

    inventory.refresh_from_db()
    assert inventory.vehicle == vehicle
    assert inventory.vehicle_fireplan_id == 9001
    assert inventory.vector == vector


def test_duplicate_item_ids_in_a_source_result_fail_without_duplicate_rows():
    client = FakeClient(
        radio_items=[
            {
                "fireplan_item_id": "same-id",
                "item_type_id": 1010,
                "item_type_name": "Radio portable Astrid",
                "serial_number": "00001",
            },
            {
                "fireplan_item_id": "same-id",
                "item_type_id": 1010,
                "item_type_name": "Radio portable Astrid",
                "serial_number": "00002",
            },
        ]
    )

    result = synchronize_fireplan_inventories(client)

    inventory = FireplanInventory.objects.get(uuid="inv-1")
    assert result["failed"] == 1
    assert inventory.sync_status == FireplanInventory.SyncStatus.FAILED
    assert inventory.radio_items == []
    assert inventory.radio_observations.count() == 0
