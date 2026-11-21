from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from fireplan.client import FireplanInventoryError
from fireplan.models import FireplanCredential, FireplanInventory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(db):
    user = get_user_model().objects.create_superuser(
        username="inventory-admin", email="admin@example.test", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def regular_client(db):
    user = get_user_model().objects.create_user(
        username="inventory-user", password="test-password-123"
    )
    client = Client()
    client.force_login(user)
    return client


def source_summary(uuid: str) -> dict:
    return {
        "uuid": uuid,
        "vehicleAlphaCode": "AMB-1",
        "inventoryTypeName": "Inventory close",
        "doneInName": "Post A",
        "doneByFullName": "Operator",
        "overseenByFullName": "Supervisor",
        "closedAt": "2026-11-20 09:00:00",
        "createdAt": "2026-11-20 08:00:00",
        "updatedAt": "2026-11-20 09:00:00",
        "hasIncidentReports": False,
        "isCompleteAfterCompletion": True,
        "isCompleteBeforeCompletion": False,
        "isQuantityCountExcluded": False,
        "isTestStandard": False,
        "remainingMissingFollowedCount": 0,
    }


def test_inventory_list_fetches_one_source_page_and_merges_local_sync_state(admin_client):
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password="encrypted-password"
    )
    FireplanInventory.objects.create(
        uuid="stored-inventory",
        vehicle_alpha_code="AMB-1",
        source_closed_at=datetime(2026, 11, 20, 9, tzinfo=UTC),
        sync_status=FireplanInventory.SyncStatus.SYNCED,
        last_successful_sync_at=datetime(2026, 11, 20, 10, tzinfo=UTC),
    )
    source_page = Mock()
    source_page.fetch_inventory_summary_page.return_value = (
        [source_summary("stored-inventory"), source_summary("new-inventory")],
        41,
    )
    source_page.refreshed_cookie_data.return_value = "new-cookie-data"
    with (
        patch("fireplan.views.decrypt_secret", return_value="plain-secret"),
        patch("fireplan.views.encrypt_secret", side_effect=lambda value: f"encrypted:{value}"),
        patch("fireplan.views.FireplanInventoryClient", return_value=source_page) as client_class,
    ):
        response = admin_client.get(reverse("fireplan-inventories"), {"page": 2, "page_size": 2})

    assert response.status_code == 200
    payload = response.json()
    assert (payload["count"], payload["page"], payload["page_size"]) == (41, 2, 2)
    assert payload["results"][0]["uuid"] == "stored-inventory"
    assert payload["results"][0]["sync_status"] == "synced"
    assert payload["results"][0]["last_successful_sync_at"]
    assert payload["results"][1]["uuid"] == "new-inventory"
    assert payload["results"][1]["sync_status"] == "not_synced"
    source_page.fetch_inventory_radio_items.assert_not_called()
    client_class.return_value.fetch_inventory_summaries.assert_not_called()
    client_class.return_value.fetch_inventory_summary_page.assert_called_once_with(first=2, rows=2)
    assert FireplanCredential.objects.get(pk=1).encrypted_cookies == "encrypted:new-cookie-data"


def test_inventory_list_rejects_invalid_page_parameters(admin_client):
    for query in ("?page=0", "?page_size=0", "?page_size=101", "?page=no"):
        response = admin_client.get(reverse("fireplan-inventories") + query)
        assert response.status_code == 400


def test_inventory_management_api_requires_admin(regular_client):
    assert regular_client.get(reverse("fireplan-inventories")).status_code == 403
    assert (
        regular_client.post(
            reverse("fireplan-sync-inventories"),
            data={"start_date": "2026-11-01", "end_date": "2026-11-02"},
            content_type="application/json",
        ).status_code
        == 403
    )
    assert Client().get(reverse("fireplan-inventories")).status_code == 403


def test_inventory_period_start_rejects_missing_invalid_and_reversed_dates(admin_client):
    for data in (
        {"start_date": "2026-11-01"},
        {"start_date": "2026-11-31", "end_date": "2026-12-01"},
        {"start_date": "2026-11-03", "end_date": "2026-11-02"},
    ):
        response = admin_client.post(
            reverse("fireplan-sync-inventories"), data=data, content_type="application/json"
        )
        assert response.status_code == 400


def test_inventory_period_start_queues_forced_task_with_iso_date_strings(admin_client):
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password="encrypted-password"
    )
    with (
        patch("fireplan.views.decrypt_secret", return_value="plain-secret"),
        patch("fireplan.views.synchronize_inventories.apply_async") as apply_async,
    ):
        apply_async.return_value.id = "inventory-task-123"
        response = admin_client.post(
            reverse("fireplan-sync-inventories"),
            data={"start_date": "2026-11-01", "end_date": "2026-11-30"},
            content_type="application/json",
        )

    assert response.status_code == 202
    assert response.json() == {"task_id": "inventory-task-123", "status": "PENDING"}
    apply_async.assert_called_once_with(
        kwargs={"start_date": "2026-11-01", "end_date": "2026-11-30"}
    )


def test_inventory_list_reports_missing_credentials_and_source_errors_safely(admin_client):
    assert admin_client.get(reverse("fireplan-inventories")).status_code == 400
    FireplanCredential.objects.create(
        pk=1, login="fireplan-user", encrypted_password="encrypted-password"
    )
    with (
        patch("fireplan.views.decrypt_secret", return_value="plain-secret"),
        patch(
            "fireplan.views.FireplanInventoryClient",
            side_effect=FireplanInventoryError("source unavailable"),
        ),
    ):
        response = admin_client.get(reverse("fireplan-inventories"))

    assert response.status_code == 502
    assert (
        response.json()["detail"]
        == "FirePlan-inventarissamenvattingen konden niet worden opgehaald."
    )
    assert "source unavailable" not in response.content.decode()
