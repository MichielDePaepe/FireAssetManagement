import pytest
from django.core.management import call_command

from suivo.models import SuivoDevice, SuivoSyncState, SuivoUnit
from suivo.synchronization import synchronize_suivo_snapshot


@pytest.mark.django_db
def test_upserts_units_devices_and_status_without_deleting_missing_records():
    synchronize_suivo_snapshot(
        [{"@id": "unit-1", "name": "Truck 1"}, {"@id": "unit-2", "name": "Truck 2"}],
        [{"imei": "device-1", "type": "GPS", "unit": "unit-1"}],
        [
            {
                "unit": {"@id": "unit-1"},
                "last-seen": "2026-11-25T10:00:00Z",
                "last-position": {
                    "@time-indicator": "2026-11-25T09:59:00Z",
                    "coordinate": {"lat": 1},
                },
            }
        ],
    )
    result = synchronize_suivo_snapshot(
        [{"@id": "unit-1", "name": "Truck 1 updated"}],
        [
            {"imei": "device-1", "type": "GPS PRO", "unit": "unit-1"},
            {"imei": "device-2", "type": "GPS"},
        ],
        [],
    )

    assert result == {"units": 1, "devices": 2, "statuses": 0}
    assert SuivoUnit.objects.count() == 2
    assert SuivoDevice.objects.count() == 2
    assert SuivoUnit.objects.get(external_id="unit-1").name == "Truck 1 updated"
    assert SuivoUnit.objects.get(external_id="unit-1").last_seen_at is not None
    assert SuivoDevice.objects.get(external_id="device-1").unit.external_id == "unit-1"
    assert SuivoUnit.objects.get(external_id="unit-1").position_at is not None


@pytest.mark.django_db
def test_rejects_unstable_source_ids_before_writing():
    with pytest.raises(ValueError, match="identifier"):
        synchronize_suivo_snapshot([{"name": "Missing id"}], [], [])
    assert SuivoUnit.objects.count() == 0


@pytest.mark.django_db
def test_migrations_are_current():
    call_command("makemigrations", "suivo", check=True, dry_run=True, verbosity=0)


@pytest.mark.django_db
def test_failed_sync_preserves_snapshot_and_sets_safe_error(monkeypatch):
    from suivo.client import SuivoError
    from suivo.tasks import synchronize_suivo

    SuivoUnit.objects.create(external_id="unit-1", name="Existing", data={})

    class BrokenClient:
        def fetch_units(self):
            return [{"@id": "unit-new", "name": "Partial"}]

        def fetch_devices(self):
            raise SuivoError("Suivo API is niet bereikbaar.")

    class Progress:
        def __init__(self, _task):
            pass

        def set_progress(self, *_args, **_kwargs):
            pass

    monkeypatch.setattr("suivo.tasks.SuivoClient", BrokenClient)
    monkeypatch.setattr("suivo.tasks.ProgressRecorder", Progress)
    with pytest.raises(SuivoError):
        synchronize_suivo.run()

    assert list(SuivoUnit.objects.values_list("external_id", flat=True)) == ["unit-1"]
    state = SuivoSyncState.objects.get(pk=1)
    assert state.last_succeeded_at is None
    assert "niet bereikbaar" in state.last_error


@pytest.mark.django_db
def test_sync_view_is_admin_only_and_returns_task_id(monkeypatch, settings):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from suivo.tasks import synchronize_suivo

    settings.SUIVO_CLIENT_ID = "configured"
    settings.SUIVO_CLIENT_SECRET = "configured"
    user = get_user_model().objects.create_user(username="suivo-admin", is_staff=True)
    client = APIClient()
    client.force_authenticate(user)
    monkeypatch.setattr(
        synchronize_suivo,
        "apply_async",
        lambda: type("Task", (), {"id": "task-123"})(),
    )
    response = client.post("/api/suivo/sync/", {}, format="json")
    assert response.status_code == 202
    assert response.data["task_id"] == "task-123"

    regular = get_user_model().objects.create_user(username="suivo-user", is_staff=False)
    client.force_authenticate(regular)
    assert client.post("/api/suivo/sync/", {}, format="json").status_code == 403


@pytest.mark.django_db
def test_maps_live_suivo_at_id_and_imei_fields():
    synchronize_suivo_snapshot(
        [{"@id": 42, "name": "Truck 42"}],
        [{"@id": 9, "@imei": "imei-value", "type": "INSTALL", "unit": {"@id": 42}}],
        [{"unit": {"@id": 42}, "last-seen": "2026-11-25T10:00:00Z"}],
    )
    device = SuivoDevice.objects.get(external_id="9")
    assert device.imei == "imei-value"
    assert device.unit.external_id == "42"
