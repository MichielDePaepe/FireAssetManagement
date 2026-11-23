from datetime import UTC, datetime, timedelta

import pytest
from django.db import IntegrityError, transaction

from assets.models import Pager, PagerType, Radio
from citygis.models import Vector, VectorVehicleHistory, Vehicle
from fireplan.inventory_relationships import resolve_inventory_relationship
from fireplan.models import FireplanInventory, FireplanRadioObservation

pytestmark = pytest.mark.django_db


def inventory(**overrides):
    values = {
        "uuid": "inventory-uuid-1",
        "vehicle_alpha_code": "AMB-1",
        "inventory_type_name": "Inventory close",
        "source_created_at": datetime(2026, 11, 20, 8, tzinfo=UTC),
        "source_closed_at": datetime(2026, 11, 20, 9, tzinfo=UTC),
    }
    values.update(overrides)
    return FireplanInventory.objects.create(**values)


def test_inventory_stores_metadata_and_has_unique_source_uuid():
    row = inventory(
        done_in_name="Post A",
        done_by_full_name="Operator",
        overseen_by_full_name="Supervisor",
        has_incident_reports=False,
        is_complete_after_completion=True,
        is_complete_before_completion=False,
        is_quantity_count_excluded=False,
        is_test_standard=False,
        remaining_missing_followed_count=2,
        radio_items=[{"fireplan_item_id": "item-1", "serial_number": "000012"}],
        mapping_version=1,
    )

    assert row.vehicle_alpha_code == "AMB-1"
    assert row.done_in_name == "Post A"
    assert row.done_by_full_name == "Operator"
    assert row.overseen_by_full_name == "Supervisor"
    assert row.source_closed_at == datetime(2026, 11, 20, 9, tzinfo=UTC)
    assert row.radio_items[0]["serial_number"] == "000012"
    assert row.sync_status == FireplanInventory.SyncStatus.PENDING
    assert row.last_successful_sync_at is None
    assert row.last_error == ""

    with pytest.raises(IntegrityError), transaction.atomic():
        inventory()


def test_radio_observation_preserves_tei_as_text_and_is_unique_per_source_item():
    row = inventory()
    observation = FireplanRadioObservation.objects.create(
        inventory=row,
        fireplan_item_id="item-1",
        item_type_id=1010,
        serial_number="0000123405",
    )

    assert observation.serial_number == "0000123405"
    assert isinstance(observation.serial_number, str)
    assert observation.radio is None
    assert observation.pager is None
    with pytest.raises(IntegrityError), transaction.atomic():
        FireplanRadioObservation.objects.create(
            inventory=row,
            fireplan_item_id="item-1",
            item_type_id=1010,
            serial_number="different",
        )


def test_radio_observation_cannot_link_both_radio_and_pager():
    row = inventory()
    radio = Radio.objects.create(tei="000000000000101")
    pager_type = PagerType.objects.create(name="T1")
    pager = Pager.objects.create(serial_number="PAGER-101", type=pager_type)

    with pytest.raises(IntegrityError), transaction.atomic():
        FireplanRadioObservation.objects.create(
            inventory=row,
            fireplan_item_id="item-both",
            item_type_id=1010,
            serial_number="000000000000101",
            radio=radio,
            pager=pager,
        )


def test_relationship_resolver_matches_exactly_one_vehicle_and_time_valid_vector():
    vehicle = Vehicle.objects.create(fireplan_id=501, alphacode="AMB-1")
    vector = Vector.objects.create(vector_code="V-1")
    closed_at = datetime(2026, 11, 20, 9, tzinfo=UTC)
    VectorVehicleHistory.objects.create(
        vector=vector,
        vehicle=vehicle,
        observed_at=closed_at,
        ended_at=closed_at + timedelta(minutes=5),
    )

    result = resolve_inventory_relationship("AMB-1", closed_at)

    assert result.vehicle == vehicle
    assert result.vehicle_fireplan_id == 501
    assert result.vector == vector


def test_relationship_resolver_honors_half_open_history_interval_boundaries():
    vehicle = Vehicle.objects.create(fireplan_id=502, alphacode="AMB-2")
    old_vector = Vector.objects.create(vector_code="V-OLD")
    new_vector = Vector.objects.create(vector_code="V-NEW")
    boundary = datetime(2026, 11, 20, 9, tzinfo=UTC)
    VectorVehicleHistory.objects.create(
        vector=old_vector,
        vehicle=vehicle,
        observed_at=boundary - timedelta(minutes=10),
        ended_at=boundary,
    )
    VectorVehicleHistory.objects.create(
        vector=new_vector,
        vehicle=vehicle,
        observed_at=boundary,
    )

    result = resolve_inventory_relationship("AMB-2", boundary)

    assert result.vehicle == vehicle
    assert result.vector == new_vector


def test_relationship_resolver_leaves_missing_or_ambiguous_matches_unknown():
    at = datetime(2026, 11, 20, 9, tzinfo=UTC)
    Vehicle.objects.create(fireplan_id=503, alphacode="AMB-3")

    missing = resolve_inventory_relationship("not-present", at)
    assert missing.vehicle is None
    assert missing.vehicle_fireplan_id is None
    assert missing.vector is None

    Vehicle.objects.create(fireplan_id=504, alphacode="AMB-3")
    ambiguous = resolve_inventory_relationship("AMB-3", at)
    assert ambiguous.vehicle is None
    assert ambiguous.vehicle_fireplan_id is None
    assert ambiguous.vector is None


def test_relationship_resolver_keeps_vehicle_when_vector_history_is_missing():
    vehicle = Vehicle.objects.create(fireplan_id=505, alphacode="AMB-4")

    result = resolve_inventory_relationship("AMB-4", datetime(2026, 11, 20, 9, tzinfo=UTC))

    assert result.vehicle == vehicle
    assert result.vehicle_fireplan_id == 505
    assert result.vector is None


def test_relationship_vehicle_match_is_exact_and_case_sensitive():
    Vehicle.objects.create(fireplan_id=506, alphacode="AMB-5")

    result = resolve_inventory_relationship("amb-5", datetime(2026, 11, 20, 9, tzinfo=UTC))

    assert result.vehicle is None
    assert result.vehicle_fireplan_id is None
