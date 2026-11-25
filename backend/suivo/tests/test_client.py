from urllib.parse import urlsplit

import pytest
from django.test import override_settings

from suivo.client import SuivoClient, SuivoError


class Response:
    def __init__(self, payload, status=200):
        import json

        self.body = json.dumps(payload).encode()
        self.status = status

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None


@override_settings(
    SUIVO_CLIENT_ID="client-id",
    SUIVO_CLIENT_SECRET="client-secret",
    SUIVO_BASE_URL="https://suivo.example",
)
def test_client_credentials_and_collection_mapping(monkeypatch):
    requests = []

    def open_request(request, timeout):
        requests.append((request, timeout))
        if request.full_url.endswith("/oauth/token?grant_type=client_credentials"):
            return Response({"access_token": "secret-token", "expires_in": 3600})
        if urlsplit(request.full_url).path == "/units":
            return Response({"unit": [{"@id": "u1", "name": "AUTO 1"}]})
        if urlsplit(request.full_url).path == "/devices":
            return Response({"device": [{"@id": 11, "@imei": "i1", "type": "GPS"}]})
        return Response({"unit-status": [{"@id": "s1", "unit": "u1", "last-seen": "t"}]})

    monkeypatch.setattr("suivo.client.urlopen", open_request)
    client = SuivoClient()

    assert client.fetch_units() == [{"@id": "u1", "name": "AUTO 1"}]
    assert client.fetch_devices() == [{"@id": 11, "@imei": "i1", "type": "GPS"}]
    assert client.fetch_unit_statuses()[0]["unit"] == "u1"
    assert requests[0][0].get_header("Authorization").startswith("Basic ")
    assert "secret-token" not in requests[1][0].headers.values()
    assert requests[1][0].get_header("Authorization") == "Bearer secret-token"


def test_rejects_malformed_response_without_echoing_payload(monkeypatch):
    monkeypatch.setattr("suivo.client.urlopen", lambda *_a, **_k: Response({"unit": "wrong"}))
    monkeypatch.setattr("suivo.client.SuivoClient._token", lambda self: "safe-token")

    with pytest.raises(SuivoError, match="unit") as error:
        SuivoClient().fetch_units()
    assert "wrong" not in str(error.value)


@override_settings(SUIVO_CLIENT_ID="client-id", SUIVO_CLIENT_SECRET="client-secret")
def test_oauth_error_does_not_leak_credentials(monkeypatch):
    from urllib.error import HTTPError

    def fail(request, timeout):
        raise HTTPError(request.full_url, 401, "denied", {}, None)

    monkeypatch.setattr("suivo.client.urlopen", fail)
    with pytest.raises(SuivoError) as error:
        SuivoClient().fetch_units()
    assert "client-secret" not in str(error.value)
    assert "client-id" not in str(error.value)
