import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from assets.models import Pager, PagerType

pytestmark = pytest.mark.django_db

QR_URL = "https://infoscan.firebru.brussels?data=1,1,4321,1010"


@pytest.fixture
def scan_client(db):
    user = get_user_model().objects.create_user(username="scan-user", password="test-password-123")
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def pager(db):
    pager_type = PagerType.objects.first()
    return Pager.objects.create(
        serial_number="SN-SCAN-1",
        type=pager_type,
        fireplan_id=4321,
        fireplan_qr_url=QR_URL,
    )


def test_scanlookup_matches_complete_url_and_preserves_raw_scan(scan_client, pager):
    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["raw_scan"] == QR_URL
    assert response.json()["pager"]["id"] == pager.id


def test_scanlookup_matches_documented_keyboard_layout_variant(scan_client, pager):
    raw_scan = 'httpsM==infoscqn:firebru:brussels+dqtq-&;&;’"é&;&à&à'
    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": raw_scan},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["raw_scan"] == raw_scan
    assert response.json()["pager"]["id"] == pager.id


def test_scanlookup_matches_exactly_doubled_scan(scan_client, pager):
    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": QR_URL + QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["pager"]["id"] == pager.id


@pytest.mark.parametrize(
    "value",
    ["", "not-a-url", "https://example.test/4321", "https://infoscan.firebru.brussels?data=bad"],
)
def test_scanlookup_rejects_invalid_or_unknown_scan(scan_client, value):
    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": value},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "message" in response.json()


def test_scanlookup_does_not_match_by_fireplan_id_only(scan_client):
    Pager.objects.create(
        serial_number="SN-SCAN-OTHER",
        type=PagerType.objects.first(),
        fireplan_id=4321,
        fireplan_qr_url="https://infoscan.firebru.brussels?data=1,1,4321,1845",
    )

    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 404


def test_scanlookup_reports_unknown_valid_fireplan_url(scan_client):
    response = scan_client.post(
        reverse("pager-scanlookup"),
        data={"scanned_line": "https://infoscan.firebru.brussels?data=1,1,9876,1010"},
        content_type="application/json",
    )

    assert response.status_code == 404
    assert "message" in response.json()


def test_scanlookup_requires_login():
    response = Client().post(
        reverse("pager-scanlookup"),
        data={"scanned_line": QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 403
