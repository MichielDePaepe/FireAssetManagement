import json
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit
from urllib.request import Request

from django.conf import settings

from .client import (
    FireplanInventoryError,
    FireplanLoginError,
    _opener,
    _same_fireplan_origin,
    deserialize_cookie_jar,
    ensure_fireplan_session,
    serialize_cookie_jar,
)
from .inventory_mapping import (
    extract_mapped_items,
    load_inventory_mapping,
    parse_fireplan_datetime,
    resolve_mapped_container_id,
)


class FireplanInventoryClient:
    """Read closed inventory summaries and mapped radio details over Fireplan HTTPS."""

    page_size = 500

    def __init__(self, login: str, password: str, cookie_data: str | None = None) -> None:
        self.base_url = settings.FIREPLAN_BASE_URL.rstrip("/")
        parsed_base = urlsplit(self.base_url)
        self.expected_origin = parsed_base.netloc
        self.cookie_data, _ = ensure_fireplan_session(login, password, cookie_data)
        self.cookie_jar = deserialize_cookie_jar(self.cookie_data)
        self.opener = _opener(self.cookie_jar, self.expected_origin)
        self.mapping = load_inventory_mapping()
        self.headers = {
            "User-Agent": "PagerAssetManagement/1.0 (Fireplan integration)",
            "Accept": "application/json",
        }

    def _request_json(self, url: str) -> dict:
        try:
            with self.opener.open(Request(url, headers=self.headers), timeout=20) as response:
                response_url = response.geturl()
                if not _same_fireplan_origin(response_url, self.expected_origin):
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
            raise FireplanInventoryError("Fireplan gaf ongeldige inventaris-JSON terug.") from error
        if not isinstance(payload, dict):
            raise FireplanInventoryError("Fireplan gaf een ongeldig inventarisantwoord terug.")
        return payload

    @staticmethod
    def _page(payload: dict) -> tuple[list[dict], int]:
        records = payload.get("records")
        total = payload.get("total")
        if (
            not isinstance(records, list)
            or any(not isinstance(record, dict) for record in records)
            or isinstance(total, bool)
            or not isinstance(total, int)
            or total < 0
        ):
            raise FireplanInventoryError("Fireplan gaf een ongeldige inventarispagina terug.")
        return records, total

    @staticmethod
    def _validate_summary(record: dict) -> date:
        inventory_uuid = record.get("uuid")
        closed_at = record.get("closedAt")
        if not isinstance(inventory_uuid, str) or not inventory_uuid.strip():
            raise FireplanInventoryError("Fireplan gaf een inventarisrecord zonder geldige UUID.")
        if not isinstance(closed_at, str):
            raise FireplanInventoryError(
                "Fireplan gaf een inventarisrecord zonder geldige closedAt."
            )
        try:
            closed_date = parse_fireplan_datetime(closed_at).date()
        except (TypeError, ValueError) as error:
            raise FireplanInventoryError(
                "Fireplan gaf een ongeldig inventarisrecord closedAt."
            ) from error

        string_fields = (
            "createdAt",
            "updatedAt",
            "vehicleAlphaCode",
            "inventoryTypeName",
            "doneInName",
            "doneByFullName",
            "overseenByFullName",
        )
        for field in string_fields:
            value = record.get(field)
            if value is not None and not isinstance(value, str):
                raise FireplanInventoryError(
                    f"Fireplan gaf een ongeldig inventarisrecordveld {field}."
                )
        for field in (
            "hasIncidentReports",
            "isCompleteAfterCompletion",
            "isCompleteBeforeCompletion",
            "isQuantityCountExcluded",
            "isTestStandard",
        ):
            value = record.get(field)
            if value is not None and not isinstance(value, bool):
                raise FireplanInventoryError(
                    f"Fireplan gaf een ongeldig inventarisrecordveld {field}."
                )
        missing_count = record.get("remainingMissingFollowedCount")
        if missing_count is not None and (
            isinstance(missing_count, bool)
            or not isinstance(missing_count, int)
            or missing_count < 0
        ):
            raise FireplanInventoryError(
                "Fireplan gaf een ongeldig inventarisrecordveld remainingMissingFollowedCount."
            )
        for field in ("createdAt", "updatedAt"):
            value = record.get(field)
            if value:
                try:
                    parse_fireplan_datetime(value)
                except ValueError as error:
                    raise FireplanInventoryError(
                        f"Fireplan gaf een ongeldig inventarisrecordveld {field}."
                    ) from error
        return closed_date

    def _list_url(self, first: int, rows: int | None = None) -> str:
        path = "fr/api/inventory/inventories-type/close"
        url = urljoin(f"{self.base_url}/", path)
        query = urlencode(
            {
                "first": first,
                "rows": rows or self.page_size,
                "sortField": "closedAt",
                "sortOrder": -1,
            }
        )
        return f"{url}?{query}"

    def fetch_inventory_summary_page(self, *, first: int, rows: int) -> tuple[list[dict], int]:
        """Fetch and validate exactly one source page without requesting any details."""
        if first < 0 or rows < 1 or rows > self.page_size:
            raise ValueError("Fireplan-paginering buiten het toegestane bereik.")
        page_records, total = self._page(self._request_json(self._list_url(first, rows)))
        if len(page_records) > rows:
            raise FireplanInventoryError("Fireplan overschreed de gevraagde paginagrootte.")
        page_dates = [self._validate_summary(record) for record in page_records]
        if any(later > earlier for earlier, later in zip(page_dates, page_dates[1:], strict=False)):
            raise FireplanInventoryError(
                "Fireplan-inventarissen zijn niet op closedAt aflopend gesorteerd."
            )
        return page_records, total

    def fetch_inventory_summaries(
        self, *, start_date: date | None = None, end_date: date | None = None
    ) -> list[dict]:
        if (start_date is None) != (end_date is None):
            raise ValueError("Begindatum en einddatum moeten samen zijn opgegeven.")
        if start_date and end_date and start_date > end_date:
            raise ValueError("Begindatum mag niet na einddatum liggen.")

        records: list[dict] = []
        first = 0
        total: int | None = None
        stop_before_next_page = False
        previous_date: date | None = None

        while total is None or first < total:
            page_records, page_total = self._page(self._request_json(self._list_url(first)))
            total = page_total
            page_dates = [self._validate_summary(record) for record in page_records]
            if any(
                later > earlier for earlier, later in zip(page_dates, page_dates[1:], strict=False)
            ):
                raise FireplanInventoryError(
                    "Fireplan-inventarissen zijn niet op closedAt aflopend gesorteerd."
                )
            if previous_date and page_dates and page_dates[0] > previous_date:
                raise FireplanInventoryError(
                    "Fireplan-inventarispaginering brak de closedAt-volgorde."
                )
            if page_dates:
                previous_date = page_dates[-1]

            for record, closed_date in zip(page_records, page_dates, strict=False):
                if start_date and closed_date < start_date:
                    stop_before_next_page = True
                    break
                if end_date is None or closed_date <= end_date:
                    records.append(record)

            if stop_before_next_page or len(records) >= total:
                break
            if not page_records:
                raise FireplanInventoryError(
                    "Fireplan gaf geen records terug vóór het gerapporteerde einde."
                )
            first += len(page_records)
        return records

    def fetch_inventory_radio_items(self, inventory_uuid: str) -> list[dict]:
        escaped_uuid = quote(inventory_uuid, safe="")
        root = "fr/api/inventory/inventories-type/close"
        tree_url = urljoin(f"{self.base_url}/", f"{root}/{escaped_uuid}/inventoried-container/tree")
        tree = self._request_json(tree_url)
        tree_records, _ = self._page(tree)
        try:
            container_uuid = resolve_mapped_container_id({"records": tree_records}, self.mapping)
        except ValueError as error:
            raise FireplanInventoryError(
                "Fireplan-containerboom wijkt af van de mapping."
            ) from error

        item_path = (
            f"{root}/inventoried-container/{quote(container_uuid, safe='')}/inventoried-item/list"
        )
        item_url = urljoin(f"{self.base_url}/", item_path)
        first = 0
        total: int | None = None
        item_records: list[dict] = []
        while total is None or first < total:
            query = urlencode({"first": first, "rows": self.page_size})
            page_records, page_total = self._page(self._request_json(f"{item_url}?{query}"))
            total = page_total
            item_records.extend(page_records)
            if len(item_records) >= total:
                break
            if not page_records:
                raise FireplanInventoryError(
                    "Fireplan gaf geen inventarisitems terug vóór het gerapporteerde einde."
                )
            first += len(page_records)

        try:
            return extract_mapped_items({"records": tree_records}, item_records, self.mapping)
        except ValueError as error:
            raise FireplanInventoryError(
                "Fireplan-radio-items wijken af van de mapping."
            ) from error

    def refreshed_cookie_data(self) -> str:
        return serialize_cookie_jar(self.cookie_jar)
