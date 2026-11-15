import pytest

from assets.models import Pager, PagerType
from fireplan.synchronization import synchronize_fireplan_pagers

pytestmark = pytest.mark.django_db


def qr_record(
    fireplan_id: int,
    name: str = "Swissphone s.QUAD X35",
    serial_number: str = "SN-100",
    qr_url: str = "https://infoscan.firebru.brussels/?data=1,1,100,1845",
) -> dict[str, object]:
    return {
        "id": fireplan_id,
        "name": name,
        "serialNumber": serial_number,
        "qrCode": qr_url,
    }


def test_sync_imports_matching_records_and_preserves_local_only_pagers():
    pager_type = PagerType.objects.get(name="Swissphone s.QUAD X35")
    local_only = Pager.objects.create(serial_number="LOCAL-ONLY", type=pager_type)

    result = synchronize_fireplan_pagers(
        [
            qr_record(1606, serial_number="SN-1606"),
            qr_record(1607, name="Unknown device", serial_number="SN-1607"),
        ]
    )

    imported = Pager.objects.get(fireplan_id=1606)
    assert imported.serial_number == "SN-1606"
    assert imported.type == pager_type
    assert imported.fireplan_qr_url == "https://infoscan.firebru.brussels/?data=1,1,100,1845"
    assert Pager.objects.filter(pk=local_only.pk).exists()
    assert not Pager.objects.filter(serial_number="SN-1607").exists()
    assert result == {"added": 1, "updated": 0, "unchanged": 0, "errors": []}


def test_sync_links_by_serial_then_prefers_fireplan_id_after_serial_change():
    original_type = PagerType.objects.get(name="Swissphone s.QUAD X35")
    changed_type = PagerType.objects.get(name="Swissphone RES.Q XS")
    pager = Pager.objects.create(serial_number="SN-OLD", type=original_type)

    first = synchronize_fireplan_pagers(
        [qr_record(1700, serial_number="SN-OLD", qr_url="https://infoscan.test/old")]
    )
    pager.refresh_from_db()
    assert first["updated"] == 1
    assert pager.fireplan_id == 1700

    second = synchronize_fireplan_pagers(
        [
            qr_record(
                1700,
                name=changed_type.name,
                serial_number="SN-NEW",
                qr_url="https://infoscan.test/new",
            )
        ]
    )
    pager.refresh_from_db()
    assert second["updated"] == 1
    assert pager.pk == Pager.objects.get(fireplan_id=1700).pk
    assert pager.serial_number == "SN-NEW"
    assert pager.type == changed_type
    assert pager.fireplan_qr_url == "https://infoscan.test/new"


def test_sync_counts_unchanged_records():
    pager_type = PagerType.objects.get(name="Swissphone s.QUAD X35")
    Pager.objects.create(
        serial_number="SN-SAME",
        type=pager_type,
        fireplan_id=1800,
        fireplan_qr_url="https://infoscan.test/same",
    )

    result = synchronize_fireplan_pagers(
        [qr_record(1800, serial_number="SN-SAME", qr_url="https://infoscan.test/same")]
    )

    assert result == {"added": 0, "updated": 0, "unchanged": 1, "errors": []}


def test_sync_reports_bad_rows_and_continues_with_valid_records():
    pager_type = PagerType.objects.get(name="Swissphone s.QUAD X35")
    Pager.objects.create(
        serial_number="SN-CONFLICT",
        type=pager_type,
        fireplan_id=1900,
        fireplan_qr_url="https://infoscan.test/conflict",
    )

    result = synchronize_fireplan_pagers(
        [
            qr_record(1901, serial_number="SN-CONFLICT"),
            qr_record(1902, serial_number="   "),
            qr_record(1903, serial_number="SN-VALID"),
        ]
    )

    assert result["added"] == 1
    assert result["updated"] == 0
    assert result["unchanged"] == 0
    assert [error["fireplan_id"] for error in result["errors"]] == [1901, 1902]
    assert Pager.objects.filter(fireplan_id=1903, serial_number="SN-VALID").exists()
