from datetime import UTC, datetime

import pytest
from django.db import IntegrityError, transaction

from citygis.models import (
    Service,
    Vector,
    VectorServiceHistory,
    VectorVehicleHistory,
    Vehicle,
)

pytestmark = pytest.mark.django_db


def test_relationship_history_keeps_effective_and_observed_times_separate():
    service = Service.objects.create(abbreviation="HIST-SERVICE")
    vehicle = Vehicle.objects.create(fireplan_id=5081, alphacode="HIST-VEHICLE")
    vector = Vector.objects.create(
        vector_code="HIST-VECTOR",
        service=service,
        service_abbreviation=service.abbreviation,
        vehicle=vehicle,
        source_vehicle_name=vehicle.alphacode,
    )
    observed_at = datetime(2026, 11, 15, 13, 0, tzinfo=UTC)

    service_history = VectorServiceHistory.objects.create(
        vector=vector,
        service=service,
        source_service_abbreviation=service.abbreviation,
        observed_at=observed_at,
    )
    vehicle_history = VectorVehicleHistory.objects.create(
        vector=vector,
        vehicle=vehicle,
        source_vehicle_name=vehicle.alphacode,
        observed_at=observed_at,
    )

    assert service_history.source_effective_at is None
    assert vehicle_history.source_effective_at is None
    assert service_history.observed_at == observed_at
    assert vehicle_history.observed_at == observed_at


def test_unlinked_relationship_state_preserves_raw_source_value():
    vector = Vector.objects.create(
        vector_code="HIST-UNMATCHED",
        service_abbreviation="UNKNOWN-SERVICE",
        source_vehicle_name="UNKNOWN-VEHICLE",
    )

    service_history = VectorServiceHistory.objects.create(
        vector=vector,
        service=None,
        source_service_abbreviation=vector.service_abbreviation,
    )
    vehicle_history = VectorVehicleHistory.objects.create(
        vector=vector,
        vehicle=None,
        source_vehicle_name=vector.source_vehicle_name,
    )

    assert service_history.service is None
    assert service_history.source_service_abbreviation == "UNKNOWN-SERVICE"
    assert vehicle_history.vehicle is None
    assert vehicle_history.source_vehicle_name == "UNKNOWN-VEHICLE"


def test_database_allows_at_most_one_active_history_row_per_vector_and_relation():
    vector = Vector.objects.create(vector_code="HIST-CARDINALITY")
    VectorServiceHistory.objects.create(vector=vector, source_service_abbreviation="SERVICE-A")
    VectorVehicleHistory.objects.create(vector=vector, source_vehicle_name="VEHICLE-A")

    with pytest.raises(IntegrityError), transaction.atomic():
        VectorServiceHistory.objects.create(vector=vector, source_service_abbreviation="SERVICE-B")
    with pytest.raises(IntegrityError), transaction.atomic():
        VectorVehicleHistory.objects.create(vector=vector, source_vehicle_name="VEHICLE-B")
