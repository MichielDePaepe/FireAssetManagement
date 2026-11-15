from unittest.mock import Mock

import pytest

from assets.models import Pager
from fireplan.models import FireplanCredential
from fireplan.tasks import synchronize_pagers

pytestmark = pytest.mark.django_db


def test_synchronize_pagers_task_saves_session_and_returns_progress_summary(monkeypatch):
    credential = FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password="encrypted-password",
        encrypted_cookies="encrypted-old-cookies",
    )
    decrypt = Mock(side_effect=["plain-password", "plain-cookies"])
    encrypt = Mock(return_value="encrypted-new-cookies")
    fetch = Mock(
        return_value=(
            [
                {
                    "id": 2000,
                    "name": "Swissphone s.QUAD X35",
                    "serialNumber": "SN-2000",
                    "qrCode": "https://infoscan.test/2000",
                }
            ],
            "plain-new-cookies",
        )
    )
    progress = Mock()
    monkeypatch.setattr("fireplan.tasks.decrypt_secret", decrypt)
    monkeypatch.setattr("fireplan.tasks.encrypt_secret", encrypt)
    monkeypatch.setattr("fireplan.tasks.fetch_inventory_qr_codes", fetch)
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: progress)

    result = synchronize_pagers.run()

    credential.refresh_from_db()
    assert result == {
        "message": "Fireplan-pagersynchronisatie voltooid.",
        "added": 1,
        "updated": 0,
        "unchanged": 0,
        "errors": [],
    }
    assert Pager.objects.filter(fireplan_id=2000, serial_number="SN-2000").exists()
    assert credential.encrypted_cookies == "encrypted-new-cookies"
    assert decrypt.call_count == 2
    encrypt.assert_called_once_with("plain-new-cookies")
    fetch.assert_called_once_with(
        "fireplan-user",
        "plain-password",
        "plain-cookies",
        ["Swissphone RES.Q XS", "Swissphone s.QUAD X35"],
    )
    assert progress.set_progress.call_count == 2


def test_synchronize_pagers_task_retries_fireplan_runtime_errors(monkeypatch):
    FireplanCredential.objects.create(
        pk=1,
        login="fireplan-user",
        encrypted_password="encrypted-password",
        encrypted_cookies="",
    )
    monkeypatch.setattr("fireplan.tasks.decrypt_secret", lambda _value: "plain-secret")
    monkeypatch.setattr(
        "fireplan.tasks.fetch_inventory_qr_codes",
        Mock(side_effect=RuntimeError("Fireplan unavailable")),
    )
    monkeypatch.setattr("fireplan.tasks.ProgressRecorder", lambda _task: Mock())

    with pytest.raises(RuntimeError, match="unavailable"):
        synchronize_pagers.run()
    assert RuntimeError in synchronize_pagers.autoretry_for
