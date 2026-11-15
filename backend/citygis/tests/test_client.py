import json
from email.message import Message
from http.cookiejar import CookieJar
from unittest import TestCase
from unittest.mock import patch
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPCookieProcessor, Request

from django.test import override_settings

from citygis import client


class FakeResponse:
    def __init__(self, body: bytes, url: str, headers: dict[str, str] | None = None) -> None:
        self.body = body
        self.url = url
        self.headers = Message()
        for name, value in (headers or {}).items():
            self.headers.add_header(name, value)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.body

    def geturl(self) -> str:
        return self.url

    def info(self):
        return self.headers


class FakeOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []
        self.handlers = []

    def open(self, request, timeout):
        for handler in self.handlers:
            if isinstance(handler, HTTPCookieProcessor):
                handler.cookiejar.add_cookie_header(request)
        self.requests.append((request, timeout))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        for handler in self.handlers:
            if isinstance(handler, HTTPCookieProcessor):
                handler.cookiejar.extract_cookies(response, request)
        return response


class CityGISClientTests(TestCase):
    def test_resource_parser_recurses_through_container_with_empty_vector_code(self):
        record = {"Name": "P8", "pResourceCode": "VEC-1", "StatusCode": "0"}
        payload = {
            "station": {
                "pResourceCode": None,
                "group": [record],
            }
        }

        self.assertEqual(client._resource_records(payload), [record])

    def test_resource_parser_skips_and_logs_leaf_record_without_vector_code(self):
        with self.assertLogs("citygis.client", level="ERROR") as captured:
            records = client._resource_records(
                {"Name": "P8", "pResourceCode": None, "StatusCode": "0"}
            )

        self.assertEqual(records, [])
        self.assertIn("without a valid vector code", captured.records[0].getMessage())
        self.assertEqual(captured.records[0].vector_code_type, "NoneType")

    def test_fetch_fireplan_vehicles_preserves_active_vehicle_fields(self):
        origin = "https://fireplan.example.test"
        payload = {
            "data": [
                {
                    "id": 41,
                    "alphacode": "P8",
                    "plate": "1-ABC-123",
                    "utilisation": "Pompier",
                    "chassis": "VIN-41",
                    "statut": "Actif",
                }
            ]
        }
        opener = FakeOpener(
            [
                FakeResponse(
                    json.dumps(payload).encode(),
                    f"{origin}/fr/api/charroi/vehicle/active/list",
                )
            ]
        )

        with (
            override_settings(FIREPLAN_BASE_URL=origin),
            patch.object(
                client, "ensure_fireplan_session", return_value=("cookies", False)
            ) as ensure,
            patch.object(client, "deserialize_cookie_jar", return_value=CookieJar()),
            patch.object(client, "fireplan_opener", return_value=opener),
        ):
            records, refreshed_cookies = client.fetch_fireplan_vehicles("operator", "secret", None)

        ensure.assert_called_once_with("operator", "secret", None)
        self.assertEqual(refreshed_cookies, "cookies")
        self.assertEqual(records, payload["data"])
        self.assertEqual(opener.requests[0][1], 20)
        self.assertEqual(
            opener.requests[0][0].full_url,
            f"{origin}/fr/api/charroi/vehicle/active/list",
        )

    def test_fetch_fireplan_vehicles_rejects_unrecognized_payload_and_rows(self):
        origin = "https://fireplan.example.test"
        for payload in ({"unexpected": []}, [False], [{"id": 0, "alphacode": "P8"}]):
            opener = FakeOpener(
                [
                    FakeResponse(
                        json.dumps(payload).encode(),
                        f"{origin}/fr/api/charroi/vehicle/active/list",
                    )
                ]
            )
            with (
                self.subTest(payload=payload),
                override_settings(FIREPLAN_BASE_URL=origin),
                patch.object(client, "ensure_fireplan_session", return_value=("cookies", False)),
                patch.object(client, "deserialize_cookie_jar", return_value=CookieJar()),
                patch.object(client, "fireplan_opener", return_value=opener),
                self.assertRaises(client.CityGISError),
            ):
                client.fetch_fireplan_vehicles("operator", "secret", None)

    def test_fetch_fireplan_vehicles_reports_timeout_without_secrets(self):
        origin = "https://fireplan.example.test"
        opener = FakeOpener([TimeoutError("network timeout")])
        with (
            override_settings(FIREPLAN_BASE_URL=origin),
            patch.object(client, "ensure_fireplan_session", return_value=("cookies", False)),
            patch.object(client, "deserialize_cookie_jar", return_value=CookieJar()),
            patch.object(client, "fireplan_opener", return_value=opener),
        ):
            with self.assertRaisesRegex(client.CityGISError, "kon niet worden opgehaald") as raised:
                client.fetch_fireplan_vehicles("operator", "not-for-logs", None)
        self.assertNotIn("not-for-logs", str(raised.exception))

    def test_resources_client_reuses_one_cookie_session_and_exact_query(self):
        origin = "http://resources.example.test"
        records = [
            {"Name": "P8", "pResourceCode": "VEC-1", "StatusCode": "0"},
            {"Name": "P9", "pResourceCode": "VEC-2", "StatusCode": "15"},
        ]
        payload = {"post": {"group": records}}
        opener = FakeOpener(
            [
                FakeResponse(
                    b"ok",
                    f"{origin}/php/login_resources.php",
                    {"Set-Cookie": "resources_session=session-value; Path=/"},
                ),
                FakeResponse(json.dumps(payload).encode(), f"{origin}/php/vehicule_ajax.php"),
            ]
        )
        handlers = []

        def make_opener(*items):
            handlers.extend(items)
            opener.handlers = items
            return opener

        with (
            override_settings(CITYGIS_RESOURCES_BASE_URL=origin),
            patch.object(client, "build_opener", side_effect=make_opener) as build,
        ):
            actual = client.fetch_resource_vectors("operator", "secret")

        self.assertEqual(actual, records)
        build.assert_called_once()
        cookie_handlers = [item for item in handlers if isinstance(item, HTTPCookieProcessor)]
        self.assertEqual(len(cookie_handlers), 1)
        self.assertIsInstance(cookie_handlers[0].cookiejar, CookieJar)
        self.assertEqual([timeout for _, timeout in opener.requests], [20, 30])
        login_request, get_request = [request for request, _ in opener.requests]
        self.assertEqual(login_request.get_method(), "POST")
        self.assertEqual(
            parse_qs(login_request.data.decode()),
            {"username": ["operator"], "password": ["secret"]},
        )
        self.assertEqual(get_request.get_method(), "GET")
        self.assertEqual(get_request.get_header("Cookie"), "resources_session=session-value")
        self.assertEqual(
            parse_qs(urlsplit(get_request.full_url).query),
            {"mode": ["resources"], "servicetype": ["atelier"], "version": ["cnd"], "lang": ["fr"]},
        )

    def test_resources_client_rejects_unknown_payload_and_invalid_base_url(self):
        origin = "http://resources.example.test"
        opener = FakeOpener(
            [
                FakeResponse(b"ok", f"{origin}/php/login_resources.php"),
                FakeResponse(b'{"unexpected": "payload"}', f"{origin}/php/vehicule_ajax.php"),
            ]
        )
        with (
            override_settings(CITYGIS_RESOURCES_BASE_URL=origin),
            patch.object(client, "build_opener", return_value=opener),
            self.assertRaisesRegex(client.CityGISError, "geen vectorrecords"),
        ):
            client.fetch_resource_vectors("operator", "secret")

    def test_resources_client_rejects_malformed_vector_records(self):
        origin = "http://resources.example.test"
        opener = FakeOpener(
            [
                FakeResponse(b"ok", f"{origin}/php/login_resources.php"),
                FakeResponse(
                    b'{"station": [{"pResourceCode": "VEC-1", "Name": 17}]}',
                    f"{origin}/php/vehicule_ajax.php",
                ),
            ]
        )
        with (
            override_settings(CITYGIS_RESOURCES_BASE_URL=origin),
            patch.object(client, "build_opener", return_value=opener),
            self.assertRaisesRegex(client.CityGISError, "ongeldige voertuigbenaming"),
        ):
            client.fetch_resource_vectors("operator", "secret")

    def test_resources_client_accepts_vector_without_vehicle_name(self):
        origin = "http://resources.example.test"
        record = {"pResourceCode": "VEC-1", "StatusCode": "0"}
        opener = FakeOpener(
            [
                FakeResponse(b"ok", f"{origin}/php/login_resources.php"),
                FakeResponse(
                    json.dumps({"station": [record]}).encode(),
                    f"{origin}/php/vehicule_ajax.php",
                ),
            ]
        )
        with (
            override_settings(CITYGIS_RESOURCES_BASE_URL=origin),
            patch.object(client, "build_opener", return_value=opener),
        ):
            self.assertEqual(client.fetch_resource_vectors("operator", "secret"), [record])

        with (
            patch.object(
                client.settings,
                "CITYGIS_RESOURCES_BASE_URL",
                "file:///tmp/data",
                create=True,
            ),
            self.assertRaisesRegex(client.CityGISError, "ongeldig"),
        ):
            client.fetch_resource_vectors("operator", "secret")

    def test_resources_client_reports_network_errors_without_credentials(self):
        origin = "http://resources.example.test"
        opener = FakeOpener([URLError("offline")])
        with (
            override_settings(CITYGIS_RESOURCES_BASE_URL=origin),
            patch.object(client, "build_opener", return_value=opener),
        ):
            with self.assertRaisesRegex(client.CityGISError, "niet bereikbaar") as raised:
                client.fetch_resource_vectors("operator", "not-for-logs")
        self.assertNotIn("not-for-logs", str(raised.exception))

    def test_resources_redirect_handler_rejects_origin_changes_and_downgrades(self):
        handler = client._SameOriginRedirectHandler("http://resources.example.test")
        request = Request("http://resources.example.test/php/login_resources.php")

        for target in (
            "http://evil.example.test/steal-cookies",
            "https://resources.example.test/php/login_resources.php",
        ):
            with self.subTest(target=target), self.assertRaises(client.CityGISError):
                handler.redirect_request(request, None, 302, "Found", {}, target)

    def test_resources_redirect_handler_allows_same_origin_redirects(self):
        handler = client._SameOriginRedirectHandler("http://resources.example.test")
        request = Request("http://resources.example.test/php/login_resources.php")

        redirected = handler.redirect_request(
            request, None, 302, "Found", {}, "http://resources.example.test/php/login"
        )

        self.assertEqual(redirected.full_url, "http://resources.example.test/php/login")
