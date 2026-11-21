import json
from datetime import date
from urllib.parse import parse_qs, urlsplit

import pytest

from fireplan.client import FireplanInventoryError
from fireplan.inventory_client import FireplanInventoryClient


class FakeResponse:
    def __init__(self, body: dict, url: str) -> None:
        self.body = json.dumps(body).encode()
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


def source_record(uuid: str, closed_at: str) -> dict:
    return {
        "uuid": uuid,
        "vehicleAlphaCode": "AMB-1",
        "inventoryTypeName": "Inventory close",
        "doneInName": "Post A",
        "doneByFullName": "Operator",
        "overseenByFullName": "Supervisor",
        "closedAt": closed_at,
        "createdAt": "2026-11-20 08:00:00",
        "updatedAt": "2026-11-20 09:00:00",
        "hasIncidentReports": False,
        "isCompleteAfterCompletion": True,
        "isCompleteBeforeCompletion": False,
        "isQuantityCountExcluded": False,
        "isTestStandard": False,
        "remainingMissingFollowedCount": 0,
    }


@pytest.fixture
def inventory_client(monkeypatch, settings):
    from fireplan import inventory_client as module

    settings.FIREPLAN_BASE_URL = "https://fireplan.example.test"
    opener = FakeOpener([])
    monkeypatch.setattr(module, "ensure_fireplan_session", lambda *_args: ("cookies", True))
    monkeypatch.setattr(module, "deserialize_cookie_jar", lambda _data: object())
    monkeypatch.setattr(module, "_opener", lambda *_args: opener)
    return FireplanInventoryClient("user", "password", None), opener


def response(url: str, records: list[dict], total: int) -> FakeResponse:
    return FakeResponse({"records": records, "total": total}, url)


def test_inventory_summary_client_paginates_and_validates_source_rows(inventory_client):
    client, opener = inventory_client
    base = "https://fireplan.example.test/fr/api/inventory/inventories-type/close"
    opener.responses = [
        response(base, [source_record("inv-1", "2026-11-21 11:00:00")], 2),
        response(base, [source_record("inv-2", "2026-11-20 11:00:00")], 2),
    ]

    records = client.fetch_inventory_summaries()

    assert [row["uuid"] for row in records] == ["inv-1", "inv-2"]
    assert len(opener.requests) == 2
    query = parse_qs(urlsplit(opener.requests[0][0].full_url).query)
    assert json.loads(query["multiSortMeta"][0]) == [{"field": "closedAt", "order": -1}]


def test_inventory_summary_page_client_fetches_one_requested_page(inventory_client):
    client, opener = inventory_client
    base = "https://fireplan.example.test/fr/api/inventory/inventories-type/close"
    opener.responses = [response(base, [source_record("inv-page-2", "2026-11-20 11:00:00")], 41)]

    records, total = client.fetch_inventory_summary_page(first=25, rows=25)

    assert [row["uuid"] for row in records] == ["inv-page-2"]
    assert total == 41
    query = parse_qs(urlsplit(opener.requests[0][0].full_url).query)
    assert query["first"] == ["25"]
    assert query["rows"] == ["25"]
    assert len(opener.requests) == 1


def test_inventory_summary_client_filters_inclusive_local_period_across_all_pages(
    inventory_client,
):
    client, opener = inventory_client
    base = "https://fireplan.example.test/fr/api/inventory/inventories-type/close"
    opener.responses = [
        response(
            base,
            [
                source_record("inv-after", "2026-11-21 00:00:00"),
                source_record("inv-end", "2026-11-20 23:59:59"),
            ],
            4,
        ),
        response(
            base,
            [
                source_record("inv-before", "2026-11-19 23:59:59"),
                source_record("inv-start", "2026-11-20 00:00:00"),
            ],
            4,
        ),
    ]

    records = client.fetch_inventory_summaries(
        start_date=date(2026, 11, 20), end_date=date(2026, 11, 20)
    )

    assert [row["uuid"] for row in records] == ["inv-end", "inv-start"]
    assert len(opener.requests) == 2


def test_inventory_summary_client_rejects_invalid_required_fields(inventory_client):
    client, opener = inventory_client
    base = "https://fireplan.example.test/fr/api/inventory/inventories-type/close"
    opener.responses = [response(base, [{"uuid": "", "closedAt": "invalid"}], 1)]

    with pytest.raises(FireplanInventoryError, match="inventarisrecord"):
        client.fetch_inventory_summaries()


def test_detail_client_resolves_runtime_container_id_and_returns_only_mapped_radios(
    inventory_client,
):
    client, opener = inventory_client
    root = "https://fireplan.example.test/fr/api/inventory/inventories-type/close"
    tree_url = f"{root}/inv-1/inventoried-container/tree"
    opener.responses = [
        FakeResponse(
            {
                "records": [
                    {"id": "container-from-this-inventory", "nameFr": "Cabine de conduite"}
                ],
                "total": 1,
            },
            tree_url,
        ),
        FakeResponse(
            {
                "records": [
                    {
                        "id": "radio-item",
                        "itemTypeId": 1010,
                        "itemTypeName": "Radio portable Astrid",
                        "trackedItemSerialNumber": "0000123405",
                    },
                    {
                        "id": "other-item",
                        "itemTypeId": 999,
                        "itemTypeName": "Other",
                        "trackedItemSerialNumber": "other",
                    },
                ],
                "total": 2,
            },
            f"{root}/inventoried-container/container-from-this-inventory/inventoried-item/list",
        ),
    ]

    selected = client.fetch_inventory_radio_items("inv-1")

    assert selected == [
        {
            "fireplan_item_id": "radio-item",
            "item_type_id": 1010,
            "item_type_name": "Radio portable Astrid",
            "serial_number": "0000123405",
        }
    ]
    assert "container-from-this-inventory" in opener.requests[1][0].full_url
