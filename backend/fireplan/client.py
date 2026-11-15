import json
import ssl
from html.parser import HTMLParser
from http.cookiejar import Cookie, CookieJar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import (
    HTTPCookieProcessor,
    HTTPRedirectHandler,
    HTTPSHandler,
    Request,
    build_opener,
)

from django.conf import settings


class FireplanLoginError(RuntimeError):
    pass


class FireplanInventoryError(RuntimeError):
    pass


class _LoginPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.csrf_token: str | None = None
        self.personnel_link_found = False
        self._reading_personnel_link = False
        self._link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "input" and values.get("name") == "_csrf_token":
            self.csrf_token = values.get("value")
        if tag == "a":
            classes = values.get("class", "").split()
            self._reading_personnel_link = "nav-link" in classes
            self._link_text = []

    def handle_data(self, data: str) -> None:
        if self._reading_personnel_link:
            self._link_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._reading_personnel_link:
            text = " ".join(" ".join(self._link_text).casefold().split())
            if "dossier personnel" in text:
                self.personnel_link_found = True
            self._reading_personnel_link = False


def _same_fireplan_origin(url: str, expected_origin: str) -> bool:
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.netloc.casefold() == expected_origin.casefold()


class _SameOriginRedirectHandler(HTTPRedirectHandler):
    def __init__(self, expected_origin: str) -> None:
        super().__init__()
        self.expected_origin = expected_origin

    def redirect_request(self, request, file, code, message, headers, new_url):
        if not _same_fireplan_origin(new_url, self.expected_origin):
            raise FireplanLoginError("Fireplan redirected to an unexpected host.")
        return super().redirect_request(request, file, code, message, headers, new_url)


def serialize_cookie_jar(cookie_jar: CookieJar) -> str:
    cookie_jar.clear_expired_cookies()
    cookies = [
        {
            "name": cookie.name,
            "value": cookie.value,
            "port": cookie.port,
            "port_specified": cookie.port_specified,
            "domain": cookie.domain,
            "domain_specified": cookie.domain_specified,
            "domain_initial_dot": cookie.domain_initial_dot,
            "path": cookie.path,
            "path_specified": cookie.path_specified,
            "secure": cookie.secure,
            "expires": cookie.expires,
            "discard": cookie.discard,
            "rest": cookie._rest,
        }
        for cookie in cookie_jar
    ]
    return json.dumps(cookies, separators=(",", ":"))


def deserialize_cookie_jar(cookie_data: str) -> CookieJar:
    try:
        cookies = json.loads(cookie_data)
    except json.JSONDecodeError as error:
        raise FireplanLoginError("De opgeslagen Fireplan-sessie is ongeldig.") from error
    if not isinstance(cookies, list):
        raise FireplanLoginError("De opgeslagen Fireplan-sessie is ongeldig.")
    cookie_jar = CookieJar()
    try:
        for data in cookies:
            cookie_jar.set_cookie(
                Cookie(
                    version=0,
                    name=data["name"],
                    value=data["value"],
                    port=data.get("port"),
                    port_specified=data.get("port_specified", False),
                    domain=data["domain"],
                    domain_specified=data.get("domain_specified", False),
                    domain_initial_dot=data.get("domain_initial_dot", False),
                    path=data.get("path", "/"),
                    path_specified=data.get("path_specified", True),
                    secure=data.get("secure", True),
                    expires=data.get("expires"),
                    discard=data.get("discard", True),
                    comment=None,
                    comment_url=None,
                    rest=data.get("rest", {}),
                    rfc2109=False,
                )
            )
    except (KeyError, TypeError, ValueError) as error:
        raise FireplanLoginError("De opgeslagen Fireplan-sessie is ongeldig.") from error
    return cookie_jar


def _opener(cookie_jar: CookieJar, expected_origin: str):
    ssl_context = ssl.create_default_context()
    if settings.FIREPLAN_ALLOW_CERTIFICATE_HOSTNAME_MISMATCH:
        # Keep CA-chain validation, but permit internal aliases whose certificate
        # is issued for the canonical Fireplan hostname.
        ssl_context.check_hostname = False
    return build_opener(
        _SameOriginRedirectHandler(expected_origin),
        HTTPCookieProcessor(cookie_jar),
        HTTPSHandler(context=ssl_context),
    )


def _read_home(opener, base_url: str, expected_origin: str) -> str | None:
    home_url = urljoin(f"{base_url}/", "fr/")
    request = Request(
        home_url, headers={"User-Agent": "PagerAssetManagement/1.0 (Fireplan integration)"}
    )
    try:
        with opener.open(request, timeout=12) as response:
            if not _same_fireplan_origin(response.geturl(), expected_origin):
                raise FireplanLoginError("Fireplan redirected to an unexpected host.")
            return response.read().decode("utf-8", errors="replace")
    except HTTPError as error:
        if error.code in {401, 403}:
            return None
        raise FireplanLoginError("Fireplan-startpagina kon niet worden opgehaald.") from error
    except URLError as error:
        raise FireplanLoginError("Fireplan-startpagina kon niet worden opgehaald.") from error


def _has_authenticated_profile(home_html: str) -> bool:
    parser = _LoginPageParser()
    parser.feed(home_html)
    return parser.personnel_link_found


def ensure_fireplan_session(
    login: str, password: str, cookie_data: str | None = None
) -> tuple[str, bool]:
    base_url = settings.FIREPLAN_BASE_URL.rstrip("/")
    parsed_base = urlsplit(base_url)
    if (
        parsed_base.scheme != "https"
        or not parsed_base.hostname
        or parsed_base.username
        or parsed_base.password
        or parsed_base.query
        or parsed_base.fragment
    ):
        raise FireplanLoginError("FIREPLAN_BASE_URL moet een HTTPS-URL met hostnaam zijn.")

    if cookie_data:
        existing_cookie_jar = deserialize_cookie_jar(cookie_data)
        existing_opener = _opener(existing_cookie_jar, parsed_base.netloc)
        existing_home = _read_home(existing_opener, base_url, parsed_base.netloc)
        if existing_home and _has_authenticated_profile(existing_home):
            return serialize_cookie_jar(existing_cookie_jar), True

    cookie_jar = CookieJar()
    opener = _opener(cookie_jar, parsed_base.netloc)
    login_url = urljoin(f"{base_url}/", "fr/login")
    headers = {"User-Agent": "PagerAssetManagement/1.0 (Fireplan integration)"}
    try:
        with opener.open(Request(login_url, headers=headers), timeout=12) as response:
            if not _same_fireplan_origin(response.geturl(), parsed_base.netloc):
                raise FireplanLoginError("Fireplan redirected to een onverwachte host.")
            login_html = response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as error:
        raise FireplanLoginError("Fireplan-loginpagina kon niet worden opgehaald.") from error

    login_parser = _LoginPageParser()
    login_parser.feed(login_html)
    if not login_parser.csrf_token:
        raise FireplanLoginError("Fireplan-loginformulier of CSRF-token ontbreekt.")

    form_data = urlencode(
        {
            "auth_login[login]": login,
            "auth_login[password]": password,
            "_csrf_token": login_parser.csrf_token,
            "auth_login[submit]": "Se connecter",
        }
    ).encode("utf-8")
    try:
        with opener.open(
            Request(
                login_url,
                data=form_data,
                headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
            ),
            timeout=12,
        ) as response:
            if not _same_fireplan_origin(response.geturl(), parsed_base.netloc):
                raise FireplanLoginError("Fireplan redirected to een onverwachte host.")
    except (HTTPError, URLError, TimeoutError) as error:
        raise FireplanLoginError(
            "Fireplan heeft de login niet aanvaard of is niet bereikbaar."
        ) from error

    home_html = _read_home(opener, base_url, parsed_base.netloc)
    if not home_html or not _has_authenticated_profile(home_html):
        raise FireplanLoginError("Fireplan-sessie kon niet als aangemeld worden bevestigd.")
    return serialize_cookie_jar(cookie_jar), False


def _qr_codes_url(base_url: str, first: int, rows: int, model_names: list[str]) -> str:
    filters = {
        "name": {"value": model_names, "matchMode": "in"},
    }
    params = {
        "first": first,
        "rows": rows,
        "filters": json.dumps(filters, separators=(",", ":")),
        "filterOptionsExcluded": json.dumps(
            ["name", "internalReference", "serialNumber", "type"], separators=(",", ":")
        ),
    }
    endpoint_url = urljoin(f"{base_url.rstrip('/')}/", "fr/api/inventory/qr-codes")
    return f"{endpoint_url}?{urlencode(params)}"


def fetch_inventory_qr_codes(
    login: str,
    password: str,
    cookie_data: str | None,
    model_names: list[str],
) -> tuple[list[dict], str]:
    """Fetch all Fireplan QR records for the given exact inventory model names."""
    names = list(dict.fromkeys(name.strip() for name in model_names if name.strip()))
    if not names:
        return [], cookie_data or "[]"

    refreshed_cookie_data, _ = ensure_fireplan_session(login, password, cookie_data)
    cookie_jar = deserialize_cookie_jar(refreshed_cookie_data)
    base_url = settings.FIREPLAN_BASE_URL.rstrip("/")
    parsed_base = urlsplit(base_url)
    opener = _opener(cookie_jar, parsed_base.netloc)
    rows = 500
    first = 0
    records: list[dict] = []
    total: int | None = None
    headers = {
        "User-Agent": "PagerAssetManagement/1.0 (Fireplan integration)",
        "Accept": "application/json",
    }

    while total is None or first < total:
        request = Request(_qr_codes_url(base_url, first, rows, names), headers=headers)
        try:
            with opener.open(request, timeout=12) as response:
                response_url = response.geturl()
                if not _same_fireplan_origin(response_url, parsed_base.netloc):
                    raise FireplanLoginError("Fireplan redirected to an unexpected host.")
                if urlsplit(response_url).path.rstrip("/").endswith("/login"):
                    raise FireplanLoginError("De Fireplan-sessie is niet meer geldig.")
                body = response.read().decode("utf-8", errors="replace")
        except HTTPError as error:
            if error.code in {401, 403}:
                raise FireplanLoginError("De Fireplan-sessie is niet meer geldig.") from error
            raise FireplanInventoryError(
                "Fireplan-inventaris kon niet worden opgehaald."
            ) from error
        except (URLError, TimeoutError) as error:
            raise FireplanInventoryError(
                "Fireplan-inventaris kon niet worden opgehaald."
            ) from error

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as error:
            raise FireplanInventoryError(
                "Fireplan gaf ongeldige JSON voor de inventaris terug."
            ) from error
        if not isinstance(payload, dict):
            raise FireplanInventoryError("Fireplan gaf een ongeldig inventarisantwoord terug.")
        page_records = payload.get("records")
        page_total = payload.get("total")
        if (
            not isinstance(page_records, list)
            or isinstance(page_total, bool)
            or not isinstance(page_total, int)
            or page_total < 0
            or any(not isinstance(record, dict) for record in page_records)
        ):
            raise FireplanInventoryError("Fireplan gaf een ongeldig inventarisantwoord terug.")

        total = page_total
        records.extend(page_records)
        if len(records) >= total:
            break
        if not page_records:
            raise FireplanInventoryError(
                "Fireplan gaf geen records terug vóór het gerapporteerde einde."
            )
        first += len(page_records)

    return records, serialize_cookie_jar(cookie_jar)
