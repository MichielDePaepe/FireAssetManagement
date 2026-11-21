from datetime import date
from unittest.mock import ANY, Mock

import pytest
from django.conf import settings

from fireplan.models import FireplanCredential
from fireplan.tasks import synchronize_inventories

pytestmark = pytest.mark.django_db


def setup_task(monkeypatch, sync_result=None):
    credential = FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password="encrypted-password",
        encrypted_cookies="encrypted-cookies",
    )
    client = Mock()
    client.refreshed_cookie_data.return_value = "plain-refreshed-cookies"
    progress = Mock()
    sync = Mock(
        return_value=sync_result
        or {
            "added": 1,
            "updated": 2,
            "skipped": 3,
            "failed": 1,
            "errors": [{"uuid": "inv", "error": "detail failed"}],
        }
    )
    monkeypatch.setattr("fireplan.tasks.decrypt_secret", lambda _value: "plain-secret")
    monkeypatch.setattr("fireplan.tasks.encrypt_secret", lambda value: f"encrypted:{value}")
    monkeypatch.setattr("fireplan.tasks.FireplanInventoryClient", lambda *_args: client)
    monkeypatch.setattr("fireplan.tasks.synchronize_fireplan_inventories", sync)
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: progress)
    return credential, client, progress, sync


def test_manual_task_forces_inventory_details_and_returns_existing_task_report(monkeypatch):
    credential, client, progress, sync = setup_task(monkeypatch)
    synchronize_inventories.push_request(id="inventory-task-123")
    try:
        result = synchronize_inventories.run("2026-11-20", "2026-11-21")
    finally:
        synchronize_inventories.pop_request()

    credential.refresh_from_db()
    assert result == {
        "message": "FirePlan-inventarissynchronisatie voltooid.",
        "added": 1,
        "updated": 2,
        "skipped": 3,
        "failed": 1,
        "errors": [{"uuid": "inv", "error": "detail failed"}],
    }
    assert client.refreshed_cookie_data.called
    assert credential.encrypted_cookies == "encrypted:plain-refreshed-cookies"
    sync.assert_called_once_with(
        client,
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 21),
        force=True,
        progress_callback=ANY,
    )
    assert progress.set_progress.call_count >= 1


def test_scheduled_task_uses_selective_mode_and_beat_does_not_store_results(monkeypatch):
    _credential, client, _progress, sync = setup_task(monkeypatch)
    synchronize_inventories.push_request(id="hourly-task-123")
    try:
        synchronize_inventories.run()
    finally:
        synchronize_inventories.pop_request()

    sync.assert_called_once_with(
        client,
        start_date=None,
        end_date=None,
        force=False,
        progress_callback=ANY,
    )
    schedule = settings.CELERY_BEAT_SCHEDULE["fireplan-inventory-sync-hourly"]
    assert schedule["task"] == "fireplan.sync_inventories"
    assert schedule["schedule"] == 3600.0
    assert schedule["options"]["ignore_result"] is True
    assert synchronize_inventories.ignore_result is False


def test_single_inventory_task_forces_only_the_selected_uuid(monkeypatch):
    _credential, client, progress, sync = setup_task(monkeypatch)
    synchronize_inventories.push_request(id="single-inventory-task")
    try:
        result = synchronize_inventories.run(inventory_uuid="selected-inventory")
    finally:
        synchronize_inventories.pop_request()

    assert result["message"] == "FirePlan-inventarissynchronisatie voltooid."
    sync.assert_called_once_with(
        client,
        start_date=None,
        end_date=None,
        force=True,
        inventory_uuid="selected-inventory",
        progress_callback=ANY,
    )
    assert progress.set_progress.call_count >= 1


def test_task_rejects_partial_or_reversed_period_before_network_access(monkeypatch):
    _credential, client, _progress, sync = setup_task(monkeypatch)

    with pytest.raises(ValueError, match="samen"):
        synchronize_inventories.run("2026-11-20", None)
    with pytest.raises(ValueError, match="na einddatum"):
        synchronize_inventories.run("2026-11-22", "2026-11-21")

    client.assert_not_called()
    sync.assert_not_called()


def test_task_is_registered_for_existing_task_monitoring():
    assert synchronize_inventories.name == "fireplan.sync_inventories"
    assert RuntimeError in synchronize_inventories.autoretry_for
    assert synchronize_inventories.max_retries > 0
