import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from assets.models import Issi, Radio, RadioSubscription
from citygis.models import Vector
from inventory.models import ManagedRelationship

pytestmark = pytest.mark.django_db

QR_URL = "https://infoscan.firebru.brussels?data=1,1,4321,1010"


@pytest.fixture
def scan_client(db):
    user = get_user_model().objects.create_user(
        username="radio-scan-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def radio(db):
    return Radio.objects.create(
        tei="00000000000001",
        application=Radio.Application.PORTABLE,
        fireplan_id=4321,
        fireplan_qr_url=QR_URL,
    )


def test_authenticated_scanlookup_returns_radio_without_changing_assignments(scan_client, radio):
    vector = Vector.objects.create(vector_code="SCAN-RADIO-VECTOR")
    ManagedRelationship.relate(
        radio.managed_object, ManagedRelationship.Kind.ASSIGNED_TO, target=vector.managed_object
    )
    issi = Issi.objects.create(issi="123456", alias="Radio scan")
    RadioSubscription.assign(radio, issi)

    response = scan_client.post(
        reverse("radio-scanlookup"),
        data={"scanned_line": QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["raw_scan"] == QR_URL
    assert response.json()["radio"]["tei"] == radio.tei
    active_relations = ManagedRelationship.objects.filter(
        source=radio.managed_object, ended_at__isnull=True
    )
    assert active_relations.count() == 1
    assert RadioSubscription.objects.filter(radio=radio, ended_at__isnull=True).count() == 1


@pytest.mark.parametrize(
    "raw_scan",
    [
        'httpsM==infoscqn:firebru:brussels+dqtq-&;&;’"é&;&à&à',
        QR_URL + QR_URL,
    ],
)
def test_scanlookup_reuses_keyboard_layout_and_duplicate_scan_candidates(
    scan_client, radio, raw_scan
):
    response = scan_client.post(
        reverse("radio-scanlookup"),
        data={"scanned_line": raw_scan},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["radio"]["id"] == radio.pk


@pytest.mark.parametrize("value", ["", "not-a-url", "https://example.test/4321"])
def test_scanlookup_rejects_invalid_or_unknown_scans(scan_client, value):
    response = scan_client.post(
        reverse("radio-scanlookup"),
        data={"scanned_line": value},
        content_type="application/json",
    )

    assert response.status_code in {400, 404}
    assert "message" in response.json()


def test_scanlookup_requires_authentication():
    response = Client().post(
        reverse("radio-scanlookup"),
        data={"scanned_line": QR_URL},
        content_type="application/json",
    )

    assert response.status_code == 403
