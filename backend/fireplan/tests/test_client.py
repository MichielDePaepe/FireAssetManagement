import json
from http.cookiejar import Cookie, CookieJar
from unittest.mock import Mock
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit

import pytest

from fireplan import client
from fireplan.client import _LoginPageParser, deserialize_cookie_jar, serialize_cookie_jar


class FakeResponse:
    def __init__(self, body: bytes, url: str) -> None:
        self.body = body
        self.url = url

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.body

    def geturl(self) -> str:
        return self.url


class FakeOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append((request, timeout))
        return self.responses.pop(0)


def json_response(records, total, url):
    return FakeResponse(
        json.dumps({"records": records, "total": total}).encode(), url
    )


def test_cookie_jar_round_trip_preserves_session_cookie_attributes():
    original = CookieJar()
    original.set_cookie(
        Cookie(
            version=0,
            name="fireplan_session",
            value="opaque-cookie-value",
            port=None,
            port_specified=False,
            domain="fireplan.example.test",
            domain_specified=True,
            domain_initial_dot=False,
            path="/",
            path_specified=True,
            secure=True,
            expires=None,
            discard=True,
            comment=None,
            comment_url=None,
            rest={"HttpOnly": None},
            rfc2109=False,
        )
    )

    restored = deserialize_cookie_jar(serialize_cookie_jar(original))

    cookie = next(iter(restored))
    assert cookie.name == "fireplan_session"
    assert cookie.value == "opaque-cookie-value"
    assert cookie.domain == "fireplan.example.test"
    assert cookie.secure is True
    assert cookie._rest == {"HttpOnly": None}


def test_login_page_parser_reads_csrf_and_authenticated_profile_link():
    parser = _LoginPageParser()
    parser.feed(
        '<input name="_csrf_token" value="temporary-token">'
        '<a class="nav-link"><span>Dossier personnel</span></a>'
    )

    assert parser.csrf_token == "temporary-token"
    assert parser.personnel_link_found is True


def test_fetch_inventory_qr_codes_uses_compact_filter_and_follows_pages(monkeypatch):
    expected_origin = "https://fireplan.example.test"
    responses = [
        json_response(
            [
                {
                    "id": 1606,
                    "name": "Swissphone s.QUAD X35",
                    "serialNumber": "SN-1606",
                    "qrCode": "https://infoscan.example.test/?data=1606",
                }
            ],
            2,
            f"{expected_origin}/fr/api/inventory/qr-codes",
        ),
        json_response(
            [
                {
                    "id": 1607,
                    "name": "Swissphone RES.Q XS",
                    "serialNumber": "SN-1607",
                    "qrCode": "https://infoscan.example.test/?data=1607",
                }
            ],
            2,
            f"{expected_origin}/fr/api/inventory/qr-codes",
        ),
    ]
    opener = FakeOpener(responses)
    ensure_session = Mock(return_value=("[]", True))
    monkeypatch.setattr(client.settings, "FIREPLAN_BASE_URL", expected_origin)
    monkeypatch.setattr(client, "ensure_fireplan_session", ensure_session)
    monkeypatch.setattr(client, "_opener", lambda jar, origin: opener)

    records, refreshed_cookies = client.fetch_inventory_qr_codes(
        "fireplan-user",
        "secret",
        "[]",
        ["Swissphone s.QUAD X35", "Swissphone RES.Q XS"],
    )

    ensure_session.assert_called_once_with("fireplan-user", "secret", "[]")
    assert refreshed_cookies == "[]"
    assert [record["id"] for record in records] == [1606, 1607]
    assert [timeout for _, timeout in opener.requests] == [12, 12]
    first_query = parse_qs(urlsplit(opener.requests[0][0].full_url).query)
    second_query = parse_qs(urlsplit(opener.requests[1][0].full_url).query)
    assert first_query["first"] == ["0"]
    assert first_query["rows"] == ["500"]
    assert second_query["first"] == ["1"]
    assert json.loads(first_query["filters"][0]) == {
        "name": {
            "value": ["Swissphone s.QUAD X35", "Swissphone RES.Q XS"],
            "matchMode": "in",
        }
    }
    assert json.loads(first_query["filterOptionsExcluded"][0]) == [
        "name",
        "internalReference",
        "serialNumber",
        "type",
    ]
    assert second_query["filters"] == first_query["filters"]


def test_fetch_inventory_qr_codes_rejects_malformed_response(monkeypatch):
    expected_origin = "https://fireplan.example.test"
    opener = FakeOpener(
        [FakeResponse(b"not json", f"{expected_origin}/fr/api/inventory/qr-codes")]
    )
    monkeypatch.setattr(client.settings, "FIREPLAN_BASE_URL", expected_origin)
    monkeypatch.setattr(client, "ensure_fireplan_session", lambda *_args: ("[]", True))
    monkeypatch.setattr(client, "_opener", lambda jar, origin: opener)

    with pytest.raises(client.FireplanInventoryError, match="ongeldig"):
        client.fetch_inventory_qr_codes("user", "password", "[]", ["Swissphone s.QUAD X35"])


def test_fetch_inventory_qr_codes_rejects_redirect_to_login(monkeypatch):
    expected_origin = "https://fireplan.example.test"
    opener = FakeOpener([json_response([], 0, f"{expected_origin}/fr/login")])
    monkeypatch.setattr(client.settings, "FIREPLAN_BASE_URL", expected_origin)
    monkeypatch.setattr(client, "ensure_fireplan_session", lambda *_args: ("[]", True))
    monkeypatch.setattr(client, "_opener", lambda jar, origin: opener)

    with pytest.raises(client.FireplanLoginError, match="sessie"):
        client.fetch_inventory_qr_codes("user", "password", "[]", ["Swissphone s.QUAD X35"])


def test_fetch_inventory_qr_codes_rejects_cross_origin_response(monkeypatch):
    expected_origin = "https://fireplan.example.test"
    opener = FakeOpener([json_response([], 0, "https://other.example.test/api/qr-codes")])
    monkeypatch.setattr(client.settings, "FIREPLAN_BASE_URL", expected_origin)
    monkeypatch.setattr(client, "ensure_fireplan_session", lambda *_args: ("[]", True))
    monkeypatch.setattr(client, "_opener", lambda jar, origin: opener)

    with pytest.raises(client.FireplanLoginError, match="unexpected host"):
        client.fetch_inventory_qr_codes("user", "password", "[]", ["Swissphone s.QUAD X35"])


def test_fetch_inventory_qr_codes_reports_network_errors(monkeypatch):
    expected_origin = "https://fireplan.example.test"

    class UnavailableOpener:
        def open(self, _request, timeout):
            raise URLError("offline")

    monkeypatch.setattr(client.settings, "FIREPLAN_BASE_URL", expected_origin)
    monkeypatch.setattr(client, "ensure_fireplan_session", lambda *_args: ("[]", True))
    monkeypatch.setattr(client, "_opener", lambda jar, origin: UnavailableOpener())

    with pytest.raises(client.FireplanInventoryError, match="niet worden opgehaald"):
        client.fetch_inventory_qr_codes("user", "password", "[]", ["Swissphone s.QUAD X35"])
