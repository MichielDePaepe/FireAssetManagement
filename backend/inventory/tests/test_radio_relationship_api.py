import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from assets.models import Radio
from citygis.models import Location, Vector, Vehicle
from inventory.models import ManagedRelationship, PhysicalLocationObservation

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_client(db):
    user = get_user_model().objects.create_superuser(
        username="radio-placement-admin",
        email="radio-placement@example.test",
        password="test-password-123",
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="radio-placement-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


def put_relationship(client, radio, data):
    return client.put(
        reverse("inventory-radio-relationship", args=[radio.pk]),
        data=data,
        content_type="application/json",
    )


def test_portable_radio_relationship_replacement_keeps_history(staff_client):
    radio = Radio.objects.create(tei="00000000000101")
    first = Vector.objects.create(vector_code="RADIO-PLACE-A")
    second = Vector.objects.create(vector_code="RADIO-PLACE-B")

    response = put_relationship(
        staff_client,
        radio,
        {
            "kind": "assigned_to",
            "target_object_id": first.managed_object_id,
            "location_id": None,
        },
    )
    assert response.status_code == 200
    first_id = response.json()["current"]["id"]
    repeated = put_relationship(
        staff_client,
        radio,
        {
            "kind": "assigned_to",
            "target_object_id": first.managed_object_id,
            "location_id": None,
        },
    )
    assert repeated.json()["current"]["id"] == first_id

    response = put_relationship(
        staff_client,
        radio,
        {
            "kind": "assigned_to",
            "target_object_id": second.managed_object_id,
            "location_id": None,
        },
    )
    assert response.status_code == 200
    assert len(response.json()["history"]) == 2
    assert response.json()["history"][0]["ended_at"] is not None
    assert response.json()["current"]["target"]["id"] == second.managed_object_id


@pytest.mark.parametrize(
    ("target_kind", "relationship_kind"),
    [
        ("vehicle", "mounted_in"),
        ("location", "installed_in"),
    ],
)
def test_vehicle_and_fixed_radios_use_typed_targets(
    staff_client, target_kind, relationship_kind
):
    radio = Radio.objects.create(tei=f"0000000000010{1 if target_kind == 'vehicle' else 2}")
    vehicle = Vehicle.objects.create(fireplan_id=88101, alphacode="RADIO-MOUNT")
    location = Location.objects.create(name="Radio installation", kind=Location.Kind.ROOM)
    target = vehicle.managed_object_id if target_kind == "vehicle" else None
    location_id = location.pk if target_kind == "location" else None

    response = put_relationship(
        staff_client,
        radio,
        {
            "kind": relationship_kind,
            "target_object_id": target,
            "location_id": location_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["current"]["kind"] == relationship_kind
    assert response.json()["current"]["location"]["id"] == location.pk if location_id else True


def test_incompatible_target_is_rejected_and_physical_observation_is_unchanged(staff_client):
    radio = Radio.objects.create(tei="00000000000103")
    vector = Vector.objects.create(vector_code="RADIO-INVALID-TARGET")
    location = Location.objects.create(name="Observed radio location")
    observation = PhysicalLocationObservation.objects.create(
        asset=radio.managed_object, location=location
    )

    response = put_relationship(
        staff_client,
        radio,
        {
            "kind": "installed_in",
            "target_object_id": vector.managed_object_id,
            "location_id": None,
        },
    )

    assert response.status_code == 400
    assert ManagedRelationship.objects.filter(source=radio.managed_object).count() == 0
    assert PhysicalLocationObservation.objects.get(pk=observation.pk).location_id == location.pk


def test_radio_relationship_can_be_cleared_without_adding_an_empty_history_row(staff_client):
    radio = Radio.objects.create(tei="00000000000104")
    location = Location.objects.create(name="Clearable location")
    put_relationship(
        staff_client,
        radio,
        {"kind": "installed_in", "target_object_id": None, "location_id": location.pk},
    )

    response = put_relationship(
        staff_client,
        radio,
        {"kind": "installed_in", "target_object_id": None, "location_id": None},
    )

    assert response.status_code == 200
    assert response.json()["current"] is None
    assert len(response.json()["history"]) == 1
    assert response.json()["history"][0]["ended_at"] is not None


def test_only_staff_can_change_radio_placement(regular_client):
    radio = Radio.objects.create(tei="00000000000105")

    response = put_relationship(
        regular_client,
        radio,
        {"kind": "assigned_to", "target_object_id": None, "location_id": None},
    )

    assert response.status_code == 403
