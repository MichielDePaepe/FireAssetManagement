import asyncio
import json
from datetime import timedelta
from io import StringIO

import pytest
from django.utils import timezone

from suivo.models import SuivoSyncState, SuivoUnit
from suivo.push import (
    SuivoPushError,
    apply_status_update,
    build_subscription_message,
    build_websocket_uri,
    handle_server_message,
    reconnect_delay,
)


def test_websocket_uri_and_subscription_use_configured_token_and_topic():
    uri = build_websocket_uri("wss://push.example/socket", "test-token")
    assert "access_token=test-token" in uri
    assert "content-type=json" in uri
    assert build_subscription_message() == {
        "subscription-message": {"subscription": [{"@topic": "UNIT_STATUS"}]}
    }


def test_application_ping_gets_json_pong_and_error_payload_is_not_echoed():
    class Socket:
        sent = []

        async def send(self, value):
            self.sent.append(value)

    socket = Socket()
    assert asyncio.run(handle_server_message(socket, '{"ping-message": {}}')) is None
    assert json.loads(socket.sent[0]) == {"ping-response-message": {}}
    with pytest.raises(SuivoPushError) as error:
        asyncio.run(handle_server_message(socket, '{"error-message":{"@error":"secret details"}}'))
    assert "secret details" not in str(error.value)


def test_push_status_is_idempotent_and_merges_partial_fields(db):
    unit = SuivoUnit.objects.create(
        external_id="42",
        name="Engine 42",
        data={},
        last_seen_at=timezone.now(),
        status_data={"last-position": {"coordinate": {"latitude": 50, "longitude": 4}}},
    )
    event = {"id": 42, "current-moving-state": {"state": "MOVING"}}
    assert apply_status_update(event) is True
    first = SuivoUnit.objects.get(pk=unit.pk)
    first_updated_at = first.source_updated_at
    assert apply_status_update(event) is True
    second = SuivoUnit.objects.get(pk=unit.pk)
    assert first.status_data == second.status_data
    assert second.source_updated_at == first_updated_at
    assert second.status_data["last-position"] == {"coordinate": {"latitude": 50, "longitude": 4}}
    assert second.status_data["current-moving-state"] == {"state": "MOVING"}


def test_push_update_ignores_unknown_units_and_reconnect_delay_is_capped(db):
    assert apply_status_update({"id": 991, "summary": "MOVING"}) is False
    assert [reconnect_delay(n) for n in (0, 1, 2, 3, 4, 8)] == [1, 2, 4, 8, 16, 60]


def test_push_connection_state_is_safe_and_observable(db):
    from suivo.push import mark_push_connected, mark_push_disconnected, mark_push_message

    mark_push_connected()
    mark_push_message()
    mark_push_disconnected("ConnectionError", retry_seconds=2)
    state = SuivoSyncState.objects.get(pk=1)
    assert state.push_connected_at is None
    assert state.push_last_message_at is not None
    assert "token" not in state.push_last_error.casefold()


def test_status_event_extracts_status_and_retry_loop_uses_backoff(monkeypatch, db):
    import suivo.consumer as consumer

    class Socket:
        async def send(self, _value):
            pass

    event = json.dumps(
        {
            "unit-status-update": {
                "@time-indicator": "2026-11-25T10:00:00Z",
                "status": {"id": 42, "last-seen": "2026-11-25T10:00:00Z"},
            }
        }
    )
    status = asyncio.run(handle_server_message(Socket(), event))
    assert status == {"id": 42, "last-seen": "2026-11-25T10:00:00Z"}

    attempts = []
    delays = []

    async def fail_once():
        attempts.append(True)
        raise ConnectionError("not shown")

    async def stop(delay):
        delays.append(delay)
        raise asyncio.CancelledError

    monkeypatch.setattr(consumer, "run_connection", fail_once)
    monkeypatch.setattr(consumer, "mark_push_disconnected", lambda *_args: None)
    monkeypatch.setattr(consumer.asyncio, "sleep", stop)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(consumer.run_consumer())
    assert len(attempts) == 1
    assert delays == [1]


def test_consumer_health_check_requires_recent_websocket_message(db):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    from suivo.push import mark_push_connected

    mark_push_connected()
    call_command("suivo_consumer_health", stdout=StringIO())
    state = SuivoSyncState.objects.get(pk=1)
    state.push_last_message_at = timezone.now() - timedelta(minutes=3)
    state.save(update_fields=["push_last_message_at"])
    with pytest.raises(CommandError, match="not healthy"):
        call_command("suivo_consumer_health", stdout=StringIO())
