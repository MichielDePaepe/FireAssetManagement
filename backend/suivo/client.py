"""Read-only Suivo REST API client."""

import base64
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from django.conf import settings


class SuivoError(RuntimeError):
    """A safe, non-sensitive Suivo API error."""


class SuivoClient:
    timeout = 20

    def __init__(self):
        self.base_url = settings.SUIVO_BASE_URL.rstrip("/")
        self.client_id = settings.SUIVO_CLIENT_ID
        self.client_secret = settings.SUIVO_CLIENT_SECRET
        self._access_token = None

    def _request(self, request: Request):
        try:
            with urlopen(request, timeout=self.timeout) as response:
                body = response.read()
        except HTTPError as error:
            status = error.code
            error.close()
            raise SuivoError(f"Suivo API-request mislukt (HTTP {status}).") from None
        except (URLError, TimeoutError, OSError):
            raise SuivoError("Suivo API is niet bereikbaar.") from None
        try:
            return json.loads(body.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise SuivoError("Suivo API gaf geen geldige JSON terug.") from None

    def _token(self) -> str:
        if self._access_token:
            return self._access_token
        if not self.client_id or not self.client_secret:
            raise SuivoError("SUIVO_CLIENT_ID en SUIVO_CLIENT_SECRET zijn niet ingesteld.")
        credentials = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode(
            "ascii"
        )
        request = Request(
            f"{self.base_url}/oauth/token?grant_type=client_credentials",
            data=b"",
            headers={
                "Accept": "application/json",
                "Authorization": f"Basic {credentials}",
                "Content-Length": "0",
            },
            method="POST",
        )
        payload = self._request(request)
        token = payload.get("access_token") if isinstance(payload, dict) else None
        if not isinstance(token, str) or not token:
            raise SuivoError("Suivo OAuth gaf geen access token terug.")
        self._access_token = token
        return token

    def _records(self, path: str, envelope: str) -> list[dict]:
        request = Request(
            urljoin(f"{self.base_url}/", path),
            headers={"Accept": "application/json", "Authorization": f"Bearer {self._token()}"},
        )
        payload = self._request(request)
        records = payload.get(envelope) if isinstance(payload, dict) else None
        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list) or any(not isinstance(row, dict) for row in records):
            raise SuivoError(f"Suivo gaf een ongeldige {envelope} respons terug.")
        return records

    def fetch_units(self) -> list[dict]:
        return self._records("units", "unit")

    def fetch_devices(self) -> list[dict]:
        return self._records("devices", "device")

    def fetch_unit_statuses(self) -> list[dict]:
        return self._records("units-last-status", "unit-status")
