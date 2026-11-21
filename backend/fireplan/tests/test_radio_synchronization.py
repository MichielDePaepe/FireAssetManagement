import pytest

from assets.models import Radio, RadioModel, TeiRange
from fireplan.radio_synchronization import synchronize_fireplan_radios

pytestmark = pytest.mark.django_db


def fireplan_radio(fireplan_id=3001, name="Radio portable Astrid", tei="00000000000001"):
    return {
        "id": fireplan_id,
        "name": name,
        "serialNumber": tei,
        "qrCode": f"https://infoscan.firebru.brussels?data=1,1,{fireplan_id},1010",
    }


def test_import_matches_by_fireplan_id_and_updates_source_fields():
    radio = Radio.objects.create(
        tei="00000000000002",
        application=Radio.Application.PORTABLE,
        fireplan_id=3001,
        fireplan_qr_url="https://infoscan.firebru.brussels?data=1,1,3001,1010",
    )

    result = synchronize_fireplan_radios([fireplan_radio(tei="00000000000003")])

    radio.refresh_from_db()
    assert (result["added"], result["updated"], result["unchanged"]) == (0, 1, 0)
    assert radio.tei == "00000000000003"
    assert radio.fireplan_id == 3001
    assert radio.application == Radio.Application.PORTABLE
    assert radio.fireplan_qr_url.endswith("3001,1010")


def test_import_assigns_configured_model_and_repeat_is_idempotent():
    model = RadioModel.objects.create(
        manufacturer="Example", name="Portable", application=Radio.Application.PORTABLE
    )
    TeiRange.objects.create(model=model, start_tei="00000000000001", end_tei="00000000000010")
    record = fireplan_radio()

    first = synchronize_fireplan_radios([record])
    radio = Radio.objects.get(fireplan_id=3001)
    original_updated_at = radio.updated_at
    second = synchronize_fireplan_radios([record])
    radio.refresh_from_db()

    assert first["added"] == 1
    assert radio.tei == record["serialNumber"]
    assert radio.model == model
    assert second["unchanged"] == 1
    assert radio.updated_at == original_updated_at


def test_import_maps_confirmed_source_names_and_keeps_local_only_radio():
    local = Radio.objects.create(tei="00000000000004", application=Radio.Application.FIXED)

    result = synchronize_fireplan_radios(
        [fireplan_radio(name="Radio mobile Astrid", fireplan_id=3002, tei="00000000000005")]
    )

    imported = Radio.objects.get(fireplan_id=3002)
    assert imported.application == Radio.Application.VEHICLE
    assert Radio.objects.filter(pk=local.pk).exists()
    assert result["added"] == 1


def test_import_reports_invalid_records_and_unsupported_names_without_serial_values():
    missing_tei = fireplan_radio(fireplan_id=3003, tei=None)
    invalid_id = fireplan_radio(fireplan_id=None)
    unsupported = fireplan_radio(fireplan_id=3004, name="Not a confirmed radio type")

    result = synchronize_fireplan_radios([missing_tei, invalid_id, unsupported])

    assert result["added"] == 0
    assert len(result["errors"]) == 2
    assert "serial_number" not in result["errors"][0]
    assert "00000000000001" not in str(result["errors"])
    assert Radio.objects.count() == 0


def test_import_reports_tei_conflict_without_overwriting_another_fireplan_radio():
    existing = Radio.objects.create(
        tei="00000000000006", application=Radio.Application.PORTABLE, fireplan_id=3005
    )

    result = synchronize_fireplan_radios(
        [fireplan_radio(fireplan_id=3006, tei="00000000000006")]
    )

    existing.refresh_from_db()
    assert result["added"] == 0
    assert len(result["errors"]) == 1
    assert existing.fireplan_id == 3005
    assert Radio.objects.count() == 1


def test_import_reports_invalid_qr_url_and_invalid_tei_without_exposing_values():
    invalid_tei = fireplan_radio(fireplan_id=3007, tei="00000000000001X")
    invalid_qr = fireplan_radio(fireplan_id=3008)
    invalid_qr["qrCode"] = "not a URL"

    result = synchronize_fireplan_radios([invalid_tei, invalid_qr])

    assert result["added"] == 0
    assert len(result["errors"]) == 2
    assert "00000000000001X" not in str(result["errors"])
