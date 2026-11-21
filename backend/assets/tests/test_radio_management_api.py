import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from assets.models import Issi, Organization, Radio, RadioModel, RadioSubscription, TeiRange

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_client(db):
    user = get_user_model().objects.create_superuser(
        username="radio-admin", email="radio-admin@example.test", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="radio-viewer", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


def test_staff_can_manage_radios_and_fireplan_fields_remain_read_only(staff_client):
    model = RadioModel.objects.create(
        manufacturer="Example", name="Portable", application=Radio.Application.PORTABLE
    )
    radio = Radio.objects.create(
        tei="00000000000001",
        application=Radio.Application.PORTABLE,
        model=model,
        fireplan_id=9001,
        fireplan_qr_url="https://infoscan.firebru.brussels?data=1,1,9001,1010",
    )

    response = staff_client.patch(
        reverse("radio-detail", args=[radio.pk]),
        data={"tei": "00000000000002", "fireplan_id": 9999, "fireplan_qr_url": "https://example.test"},
        content_type="application/json",
    )

    assert response.status_code == 200
    radio.refresh_from_db()
    assert radio.tei == "00000000000002"
    assert radio.fireplan_id == 9001
    assert radio.fireplan_qr_url.endswith("9001,1010")


def test_regular_users_can_read_but_cannot_mutate_radio_records(regular_client):
    radio = Radio.objects.create(tei="00000000000003", application=Radio.Application.FIXED)

    assert regular_client.get(reverse("radio-list")).status_code == 200
    assert regular_client.patch(
        reverse("radio-detail", args=[radio.pk]),
        data={"manufacturer": "Nope"},
        content_type="application/json",
    ).status_code == 403


def test_radio_search_matches_model_fireplan_and_current_issi(staff_client):
    model = RadioModel.objects.create(
        manufacturer="ExampleBrand", name="Model Search", application=Radio.Application.PORTABLE
    )
    radio = Radio.objects.create(
        tei="00000000000004",
        application=Radio.Application.PORTABLE,
        model=model,
        fireplan_id=907654,
    )
    issi = Issi.objects.create(issi="7654321", alias="Search Alias")
    RadioSubscription.assign(radio, issi)

    for query in ("00000000000004", "ExampleBrand", "Model Search", "907654", "7654321"):
        response = staff_client.get(reverse("radio-list"), {"search": query})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == [radio.pk]


def test_issi_search_matches_number_alias_organization_and_radio(staff_client):
    organization = Organization.objects.create(name="Organization Search")
    issi = Issi.objects.create(issi="8123456", alias="Alias Search", organization=organization)
    radio = Radio.objects.create(tei="00000000000005", application=Radio.Application.PORTABLE)
    RadioSubscription.assign(radio, issi)

    for query in ("8123456", "Alias Search", "Organization Search", "00000000000005"):
        response = staff_client.get(reverse("issi-list"), {"search": query})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == [issi.pk]


def test_subscription_api_replaces_confirmed_link_and_exposes_history(staff_client):
    first_radio = Radio.objects.create(
        tei="00000000000006", application=Radio.Application.PORTABLE
    )
    second_radio = Radio.objects.create(
        tei="00000000000007", application=Radio.Application.PORTABLE
    )
    first_issi = Issi.objects.create(issi="8234567", alias="First ISSI")
    second_issi = Issi.objects.create(issi="8345678", alias="Second ISSI")
    RadioSubscription.assign(first_radio, first_issi)
    RadioSubscription.assign(second_radio, second_issi)

    response = staff_client.post(
        reverse("radio-subscription-list"),
        data={"radio_id": first_radio.pk, "issi_id": second_issi.pk},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert RadioSubscription.objects.filter(radio=first_radio, ended_at__isnull=False).count() == 1
    assert RadioSubscription.objects.filter(radio=second_radio, ended_at__isnull=False).count() == 1

    detail = staff_client.get(reverse("radio-detail", args=[first_radio.pk])).json()
    assert detail["current_subscription"]["issi"]["id"] == second_issi.pk
    assert len(detail["subscription_history"]) == 2
    assert detail["subscription_history"][0]["ended_at"] is not None


def test_staff_can_manage_organizations_models_and_ranges(staff_client):
    organization = staff_client.post(
        reverse("organization-list"), {"name": "Ops Unit"}, content_type="application/json"
    )
    model = staff_client.post(
        reverse("radio-model-list"),
        {"manufacturer": "Maker", "name": "Portable X", "application": "portable"},
        content_type="application/json",
    )
    assert organization.status_code == 201
    assert model.status_code == 201
    range_response = staff_client.post(
        reverse("tei-range-list"),
        {
            "model_id": model.json()["id"],
            "start_tei": "00000000000100",
            "end_tei": "00000000000199",
        },
        content_type="application/json",
    )
    assert range_response.status_code == 201
    assert TeiRange.objects.count() == 1


def test_api_reports_overlapping_tei_range_as_validation_error(staff_client):
    model = RadioModel.objects.create(
        manufacturer="Maker", name="Range validation", application=Radio.Application.PORTABLE
    )
    TeiRange.objects.create(
        model=model, start_tei="00000000000100", end_tei="00000000000199"
    )

    response = staff_client.post(
        reverse("tei-range-list"),
        {
            "model_id": model.pk,
            "start_tei": "00000000000199",
            "end_tei": "00000000000210",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert TeiRange.objects.count() == 1


def test_radio_api_rejects_model_from_a_different_application(staff_client):
    model = RadioModel.objects.create(
        manufacturer="Maker", name="Fixed model", application=Radio.Application.FIXED
    )

    response = staff_client.post(
        reverse("radio-list"),
        {
            "tei": "00000000000008",
            "application": Radio.Application.PORTABLE,
            "model_id": model.pk,
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert Radio.objects.count() == 0


def test_issi_details_include_current_subscription_and_history(staff_client):
    radio = Radio.objects.create(tei="00000000000009", application=Radio.Application.PORTABLE)
    issi = Issi.objects.create(issi="8456789", alias="History detail")
    RadioSubscription.assign(radio, issi)

    response = staff_client.get(reverse("issi-detail", args=[issi.pk]))

    assert response.status_code == 200
    assert response.json()["current_subscription"]["radio"]["tei"] == radio.tei
    assert len(response.json()["subscription_history"]) == 1
