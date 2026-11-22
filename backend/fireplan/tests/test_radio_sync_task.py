from unittest.mock import Mock

import pytest

from fireplan.models import FireplanCredential
from fireplan.tasks import synchronize_radios

pytestmark = pytest.mark.django_db


def test_radio_sync_task_uses_existing_fireplan_session_and_reports_summary(monkeypatch):
    credential = FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password="encrypted-password",
        encrypted_cookies="encrypted-cookies",
    )
    decrypt = Mock(side_effect=["plain-password", "plain-cookies"])
    encrypt = Mock(return_value="encrypted-new-cookies")
    fetch = Mock(return_value=([], "plain-new-cookies"))
    sync = Mock(return_value={"added": 1, "updated": 2, "unchanged": 3, "skipped": 0, "errors": []})
    progress = Mock()
    monkeypatch.setattr("fireplan.tasks.decrypt_secret", decrypt)
    monkeypatch.setattr("fireplan.tasks.encrypt_secret", encrypt)
    monkeypatch.setattr("fireplan.tasks.fetch_inventory_qr_codes", fetch)
    monkeypatch.setattr("fireplan.tasks.synchronize_fireplan_radios", sync)
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: progress)

    result = synchronize_radios.run()

    credential.refresh_from_db()
    assert result["message"] == "FirePlan-radiosynchronisatie voltooid."
    assert result["added"] == 1
    fetch.assert_called_once_with(
        "fireplan-user", "plain-password", "plain-cookies", [
            "Radio mobile Astrid", "Radio portable Astrid"
        ]
    )
    assert sync.call_count == 1
    assert credential.encrypted_cookies == "encrypted-new-cookies"
    assert progress.set_progress.call_count >= 2


def test_radio_sync_task_requires_saved_credentials(monkeypatch):
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: Mock())

    with pytest.raises(RuntimeError, match="inloggegevens"):
        synchronize_radios.run()


def test_radio_sync_task_fetch_failure_keeps_saved_session_and_does_not_sync(monkeypatch):
    credential = FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password="encrypted-password",
        encrypted_cookies="encrypted-cookies",
    )
    monkeypatch.setattr("fireplan.tasks.decrypt_secret", lambda _value: "plain-secret")
    monkeypatch.setattr(
        "fireplan.tasks.fetch_inventory_qr_codes",
        Mock(side_effect=RuntimeError("FirePlan unavailable")),
    )
    sync = Mock()
    monkeypatch.setattr("fireplan.tasks.synchronize_fireplan_radios", sync)
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: Mock())

    with pytest.raises(RuntimeError, match="unavailable"):
        synchronize_radios.run()

    credential.refresh_from_db()
    assert credential.encrypted_cookies == "encrypted-cookies"
    sync.assert_not_called()
