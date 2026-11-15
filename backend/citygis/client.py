import json
import logging
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener

from django.conf import settings

from fireplan.client import (
    _opener as fireplan_opener,
)
from fireplan.client import (
    deserialize_cookie_jar,
    ensure_fireplan_session,
)


class CityGISError(RuntimeError):
    pass


logger = logging.getLogger(__name__)


class _SameOriginRedirectHandler(HTTPRedirectHandler):
    def __init__(self, origin: str) -> None:
        super().__init__()
        parsed_origin = urlsplit(origin)
        self.origin = (parsed_origin.scheme.casefold(), parsed_origin.netloc.casefold())

    def redirect_request(self, request, file, code, message, headers, new_url):
        parsed = urlsplit(new_url)
        if (parsed.scheme.casefold(), parsed.netloc.casefold()) != self.origin:
            raise CityGISError("CityGIS-bron stuurde door naar een onverwachte host.")
        return super().redirect_request(request, file, code, message, headers, new_url)


def _decode_json(body: bytes, source: str):
    try:
        return json.loads(body.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CityGISError(f"{source} gaf geen geldige JSON terug.") from error


def _vehicle_records(payload) -> list[dict]:
    """Accept the list and common collection envelopes used by Fireplan APIs."""
    if isinstance(payload, list):
        if any(not isinstance(row, dict) for row in payload):
            raise CityGISError("Fireplan gaf een ongeldige voertuigenlijst terug.")
        records = payload
        for row in records:
            vehicle_id = row.get("id")
            alphacode = row.get("alphacode")
            if isinstance(vehicle_id, bool) or not isinstance(vehicle_id, int) or vehicle_id <= 0:
                raise CityGISError("Fireplan gaf een ongeldig voertuigrecord terug.")
            if not isinstance(alphacode, str) or not alphacode.strip():
                raise CityGISError("Fireplan gaf een ongeldig voertuigrecord terug.")
        return records
    if isinstance(payload, dict):
        for key in ("records", "data", "items", "vehicles", "hydra:member"):
            if isinstance(payload.get(key), list | dict):
                return _vehicle_records(payload[key])
    raise CityGISError("Fireplan gaf geen herkenbare voertuigenlijst terug.")


def fetch_fireplan_vehicles(login: str, password: str, cookie_data: str | None):
    base_url = settings.FIREPLAN_BASE_URL.rstrip("/")
    refreshed_cookies, _ = ensure_fireplan_session(login, password, cookie_data)
    parsed_base = urlsplit(base_url)
    opener = fireplan_opener(deserialize_cookie_jar(refreshed_cookies), parsed_base.netloc)
    url = urljoin(f"{base_url}/", "fr/api/charroi/vehicle/active/list")
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "PagerAssetManagement/1.0"},
    )
    try:
        with opener.open(request, timeout=20) as response:
            if urlsplit(response.geturl()).netloc.casefold() != parsed_base.netloc.casefold():
                raise CityGISError("Fireplan stuurde door naar een onverwachte host.")
            return _vehicle_records(_decode_json(response.read(), "Fireplan")), refreshed_cookies
    except (HTTPError, URLError, TimeoutError) as error:
        raise CityGISError("De Fireplan-voertuigenlijst kon niet worden opgehaald.") from error


def _resource_url(path: str) -> str:
    base = settings.CITYGIS_RESOURCES_BASE_URL.rstrip("/")
    parsed = urlsplit(base)
    if (
        parsed.scheme.casefold() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise CityGISError("CITYGIS_RESOURCES_BASE_URL is ongeldig.")
    return urljoin(f"{base}/", path.lstrip("/"))


def _resource_records(payload, rejected_records: list[dict] | None = None) -> list[dict]:
    if rejected_records is None:
        rejected_records = []
    records: list[dict] = []
    if isinstance(payload, list):
        for value in payload:
            records.extend(_resource_records(value, rejected_records))
    elif isinstance(payload, dict):
        nested_values = [value for value in payload.values() if isinstance(value, dict | list)]
        looks_like_record = "pResourceCode" in payload or (
            "StatusCode" in payload
            and any(key in payload for key in ("Name", "pName", "pResourceTypeCode"))
        )
        if looks_like_record and not nested_values:
            vector_code = payload.get("pResourceCode")
            if not isinstance(vector_code, str) or not vector_code.strip():
                rejected_records.append(payload)
                logger.error(
                    "Skipping resources-service record without a valid vector code",
                    extra={
                        "record_fields": sorted(payload.keys()),
                        "vector_code_type": type(vector_code).__name__,
                    },
                )
                return records
            if payload.get("Name") is not None and not isinstance(payload.get("Name"), str):
                raise CityGISError("De resourcesdienst gaf een ongeldige voertuigbenaming terug.")
            records.append(payload)
        else:
            for value in nested_values:
                records.extend(_resource_records(value, rejected_records))
    return records


def fetch_resource_vectors(login: str, password: str) -> list[dict]:
    login_url = _resource_url("php/login_resources.php")
    resources_url = _resource_url("php/vehicule_ajax.php")
    parsed_origin = urlsplit(login_url)
    origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
    cookies = CookieJar()
    opener = build_opener(_SameOriginRedirectHandler(origin), HTTPCookieProcessor(cookies))
    form = urlencode({"username": login, "password": password}).encode()
    headers = {
        "User-Agent": "PagerAssetManagement/1.0",
        "Accept": "application/json, text/plain, */*",
    }
    try:
        login_request = Request(
            login_url,
            data=form,
            headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
        )
        with opener.open(login_request, timeout=20) as response:
            response.read()
        query = urlencode(
            {"mode": "resources", "servicetype": "atelier", "version": "cnd", "lang": "fr"}
        )
        resources_request = Request(f"{resources_url}?{query}", headers=headers)
        with opener.open(resources_request, timeout=30) as response:
            payload = _decode_json(response.read(), "De resourcesdienst")
    except CityGISError:
        raise
    except (HTTPError, URLError, TimeoutError) as error:
        raise CityGISError(
            "De CityGIS-resourcesdienst is niet bereikbaar of heeft de login geweigerd."
        ) from error
    rejected_records: list[dict] = []
    records = _resource_records(payload, rejected_records)
    if not records and not rejected_records and payload not in ([], {}):
        raise CityGISError(
            "De resourcesdienst gaf geen vectorrecords in het verwachte formaat terug."
        )
    return records
