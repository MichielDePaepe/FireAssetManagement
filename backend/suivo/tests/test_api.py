import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from citygis.models import Vehicle
from suivo.models import SuivoDevice, SuivoUnit


@pytest.mark.django_db
def test_staff_asset_endpoint_reports_exact_none_and_ambiguous_matches():
    Vehicle.objects.create(fireplan_id=1, alphacode="  Engine 1 ")
    Vehicle.objects.create(fireplan_id=2, alphacode="engine 1")
    Vehicle.objects.create(fireplan_id=3, alphacode="Engine 2")
    SuivoUnit.objects.create(external_id="u1", name="Engine 1", data={})
    SuivoUnit.objects.create(external_id="u2", name="Engine 10", data={})
    SuivoUnit.objects.create(external_id="u3", name=" engine 2 ", data={})

    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user("staff", is_staff=True))
    response = client.get("/api/suivo/assets/")

    assert response.status_code == 200
    rows = {row["external_id"]: row for row in response.data["results"]}
    assert rows["u1"]["match_status"] == "multiple"
    assert rows["u1"]["vehicle"] is None
    assert len(rows["u1"]["matches"]) == 2
    assert rows["u2"]["match_status"] == "none"
    assert rows["u3"]["match_status"] == "matched"
    assert rows["u3"]["vehicle"]["name"] == "Engine 2"


@pytest.mark.django_db
def test_device_endpoint_includes_unlinked_device_without_invented_telemetry():
    SuivoUnit.objects.create(
        external_id="u1",
        name="Engine 1",
        data={},
        last_seen_at=None,
        position=None,
        status_data={},
    )
    SuivoDevice.objects.create(
        external_id="d1",
        imei="imei-1",
        device_type="INSTALL_PREMIUM",
        data={"@id": 1, "@imei": "imei-1", "type": "INSTALL_PREMIUM"},
    )
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user("admin", is_staff=True))

    response = client.get("/api/suivo/devices/")
    assert response.status_code == 200
    row = response.data["results"][0]
    assert row["unit"] is None
    assert row["device_type"] == "INSTALL_PREMIUM"
    assert row["last_seen_at"] is None
    assert row["position"] is None
    assert row["battery_level"] is None
    assert row["battery_voltage"] is None


@pytest.mark.django_db
def test_suivo_overview_is_staff_only():
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user("user", is_staff=False))
    assert client.get("/api/suivo/assets/").status_code == 403
    assert client.get("/api/suivo/devices/").status_code == 403


@pytest.mark.django_db
def test_asset_response_keeps_explicit_battery_level_and_voltage_separate():
    SuivoUnit.objects.create(
        external_id="unit-1",
        name="Engine 1",
        data={},
        status_data={"telemetry": {"battery-level": 67, "battery-voltage": 12.4}},
    )
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user("staff-2", is_staff=True))

    response = client.get("/api/suivo/assets/")
    row = response.data["results"][0]
    assert row["battery_level"] == 67
    assert row["battery_voltage"] == 12.4
