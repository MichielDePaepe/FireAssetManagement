"""Helpers for the Suivo UNIT_STATUS websocket protocol."""

import json
from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django.utils import timezone

from .models import SuivoSyncState, SuivoUnit
from .synchronization import _datetime

PING_RESPONSE = "__suivo_ping_response__"


class SuivoPushError(RuntimeError):
    pass


def build_websocket_uri(base_url: str, access_token: str) -> str:
    parts = urlsplit(base_url)
    if parts.scheme not in {"ws", "wss"} or not parts.hostname or parts.username or parts.password:
        raise SuivoPushError("SUIVO_WSS_URL is ongeldig.")
    query = [(key, value) for key, value in parse_qsl(parts.query) if key != "access_token"]
    query.extend([("access_token", access_token), ("content-type", "json")])
    return urlunsplit((parts.scheme, parts.netloc, parts.path or "/socket", urlencode(query), ""))


def build_subscription_message() -> dict:
    return {"subscription-message": {"subscription": [{"@topic": "UNIT_STATUS"}]}}


async def handle_server_message(websocket, message: str) -> dict | str | None:
    try:
        payload = json.loads(message)
    except (TypeError, json.JSONDecodeError):
        raise SuivoPushError("Suivo WebSocket gaf een ongeldig bericht terug.") from None
    if not isinstance(payload, dict):
        raise SuivoPushError("Suivo WebSocket gaf een ongeldig bericht terug.")
    if "error-message" in payload:
        raise SuivoPushError("Suivo WebSocket heeft de verbinding geweigerd.")
    if "ping-message" in payload:
        await websocket.send(json.dumps({"ping-response-message": {}}))
        return None
    if "ping-response-message" in payload:
        return PING_RESPONSE
    event = payload.get("unit-status-update")
    status = event.get("status") if isinstance(event, dict) else None
    if status is not None and not isinstance(status, dict):
        raise SuivoPushError("Suivo WebSocket gaf een ongeldige statusupdate terug.")
    return status


def reconnect_delay(attempt: int) -> int:
    bounded_attempt = max(0, attempt)
    return 60 if bounded_attempt >= 6 else 2**bounded_attempt


def apply_status_update(status: dict) -> bool:
    identifier = status.get("id") or status.get("@id") or status.get("unit")
    if isinstance(identifier, dict):
        identifier = identifier.get("@id") or identifier.get("id")
    if identifier is None:
        return False
    unit = SuivoUnit.objects.filter(external_id=str(identifier)).first()
    if unit is None:
        return False

    merged = {**(unit.status_data or {}), **status}
    update_fields = ["status_data", "source_updated_at"]
    changed = merged != (unit.status_data or {})
    unit.status_data = merged
    if "last-seen" in status:
        last_seen = _datetime(status.get("last-seen"))
        changed = changed or unit.last_seen_at != last_seen
        unit.last_seen_at = last_seen
        update_fields.append("last_seen_at")
    if "last-position" in status:
        position = status.get("last-position")
        new_position = position if isinstance(position, dict) else None
        position_at = (
            _datetime(position.get("@time-indicator") or position.get("time"))
            if isinstance(position, dict)
            else None
        )
        changed = changed or unit.position != new_position or unit.position_at != position_at
        unit.position = new_position
        unit.position_at = position_at
        update_fields.extend(["position", "position_at"])
    if not changed:
        return True
    unit.source_updated_at = timezone.now()
    unit.save(update_fields=update_fields)
    return True


def mark_push_connected() -> None:
    state, _ = SuivoSyncState.objects.get_or_create(pk=1)
    now = timezone.now()
    state.push_connected_at = now
    state.push_last_message_at = now
    state.push_last_error = ""
    state.push_retry_at = None
    state.save(
        update_fields=[
            "push_connected_at",
            "push_last_message_at",
            "push_last_error",
            "push_retry_at",
            "updated_at",
        ]
    )


def mark_push_message() -> None:
    state, _ = SuivoSyncState.objects.get_or_create(pk=1)
    state.push_last_message_at = timezone.now()
    state.save(update_fields=["push_last_message_at", "updated_at"])


def mark_push_disconnected(error_type: str, retry_seconds: int) -> None:
    state, _ = SuivoSyncState.objects.get_or_create(pk=1)
    now = timezone.now()
    state.push_connected_at = None
    state.push_last_error = f"{error_type[:80]}; reconnecting"
    state.push_retry_at = now + timedelta(seconds=retry_seconds)
    state.save(
        update_fields=["push_connected_at", "push_last_error", "push_retry_at", "updated_at"]
    )
