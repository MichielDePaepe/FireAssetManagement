import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import Client
from django.urls import reverse

from assets.models import Pager, PagerType, RicCode

pytestmark = pytest.mark.django_db


@pytest.fixture
def pager_types():
    return list(PagerType.objects.order_by("name"))


@pytest.fixture
def client(db):
    user = get_user_model().objects.create_user(username="asset-user", password="test-password-123")
    authenticated_client = Client()
    authenticated_client.force_login(user)
    return authenticated_client


def test_initial_pager_types_are_available(pager_types):
    assert {pager_type.name for pager_type in pager_types} == {
        "Swissphone s.QUAD X35",
        "Swissphone RES.Q XS",
    }


def test_pager_list_returns_type_details(client, pager_types):
    pager = Pager.objects.create(serial_number="SN-100", type=pager_types[0])

    response = client.get(reverse("pager-list"))

    assert response.status_code == 200
    result = response.json()[0]
    assert result["id"] == pager.id
    assert result["serial_number"] == "SN-100"
    assert result["type"] == {"id": pager_types[0].id, "name": pager_types[0].name}


def test_pager_list_exposes_empty_fireplan_metadata(client, pager_types):
    Pager.objects.create(serial_number="SN-101", type=pager_types[0])

    response = client.get(reverse("pager-list"))

    assert response.status_code == 200
    result = next(item for item in response.json() if item["serial_number"] == "SN-101")
    assert result["fireplan_id"] is None
    assert result["fireplan_qr_url"] is None


def test_pager_fireplan_metadata_is_read_only(client, pager_types):
    pager = Pager.objects.create(serial_number="SN-102", type=pager_types[0])
    pager.fireplan_id = 1606
    pager.fireplan_qr_url = "https://infoscan.firebru.brussels?data=1,1,1606,1845"
    pager.save()

    response = client.patch(
        reverse("pager-detail", args=[pager.id]),
        data={
            "fireplan_id": 9999,
            "fireplan_qr_url": "https://example.test/other",
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["fireplan_id"] == 1606
    assert response.json()["fireplan_qr_url"] == (
        "https://infoscan.firebru.brussels?data=1,1,1606,1845"
    )
    pager.refresh_from_db()
    assert pager.fireplan_id == 1606
    assert pager.fireplan_qr_url == "https://infoscan.firebru.brussels?data=1,1,1606,1845"


def test_fireplan_id_is_unique_when_present(pager_types):
    Pager.objects.create(serial_number="SN-103", type=pager_types[0], fireplan_id=1606)

    with pytest.raises(IntegrityError), transaction.atomic():
        Pager.objects.create(serial_number="SN-104", type=pager_types[0], fireplan_id=1606)


def test_pager_can_be_created_and_edited(client, pager_types):
    response = client.post(
        reverse("pager-list"),
        data={"serial_number": " SN-200 ", "type_id": pager_types[0].id},
        content_type="application/json",
    )
    assert response.status_code == 201
    pager_id = response.json()["id"]
    assert response.json()["serial_number"] == "SN-200"

    response = client.patch(
        reverse("pager-detail", args=[pager_id]),
        data={"type_id": pager_types[1].id},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["type"]["name"] == pager_types[1].name


def test_pager_serial_number_is_required_and_unique(client, pager_types):
    Pager.objects.create(serial_number="SN-300", type=pager_types[0])

    missing_serial = client.post(
        reverse("pager-list"),
        data={"serial_number": "  ", "type_id": pager_types[0].id},
        content_type="application/json",
    )
    duplicate_serial = client.post(
        reverse("pager-list"),
        data={"serial_number": "SN-300", "type_id": pager_types[0].id},
        content_type="application/json",
    )

    assert missing_serial.status_code == 400
    assert duplicate_serial.status_code == 400


def test_pager_can_be_deleted(client, pager_types):
    pager = Pager.objects.create(serial_number="SN-400", type=pager_types[0])

    response = client.delete(reverse("pager-detail", args=[pager.id]))

    assert response.status_code == 204
    assert not Pager.objects.filter(pk=pager.id).exists()


def test_pager_api_requires_login():
    assert Client().get(reverse("pager-list")).status_code == 403


def test_ric_codes_can_be_managed_independently_of_pagers(client):
    response = client.post(
        reverse("ric-code-list"),
        data={
            "ric_code": "199991",
            "adc_code": "199992",
            "alias": " A HELI 1 ",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    code_id = response.json()["id"]
    assert response.json()["alias"] == "A HELI 1"
    assert response.json()["ric_code"] == "199991"
    assert response.json()["adc_code"] == "199992"
    listed = client.get(reverse("ric-code-list")).json()
    assert next(item for item in listed if item["id"] == code_id)["alias"] == "A HELI 1"

    updated = client.patch(
        reverse("ric-code-detail", args=[code_id]),
        data={"alias": "A HELI 1 updated"},
        content_type="application/json",
    )
    assert updated.status_code == 200
    assert updated.json()["alias"] == "A HELI 1 updated"

    assert client.delete(reverse("ric-code-detail", args=[code_id])).status_code == 204
    assert not RicCode.objects.filter(pk=code_id).exists()


def test_ric_codes_validate_numeric_codes(client):
    response = client.post(
        reverse("ric-code-list"),
        data={
            "ric_code": "76A711",
            "adc_code": "652711",
            "alias": "A HELI 1",
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert not RicCode.objects.filter(ric_code="76A711", adc_code="652711").exists()


def test_duplicate_ric_adc_pair_is_rejected(client):
    RicCode.objects.create(ric_code="199993", adc_code="199994", alias="PIT HSP")

    response = client.post(
        reverse("ric-code-list"),
        data={"ric_code": "199993", "adc_code": "199994", "alias": "A HSP 4"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert RicCode.objects.filter(ric_code="199993", adc_code="199994").count() == 1


def test_ric_code_api_requires_login():
    assert Client().get(reverse("ric-code-list")).status_code == 403
