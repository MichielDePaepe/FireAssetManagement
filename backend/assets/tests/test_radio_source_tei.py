import pytest
from django.core.exceptions import ValidationError

from assets.models import Radio, RadioModel, TeiRange

pytestmark = pytest.mark.django_db


def test_radio_preserves_fourteen_and_fifteen_character_source_tei():
    fourteen = "00000000000001"
    fifteen = "000000000000010"

    assert (
        Radio.objects.create(tei=fourteen, application=Radio.Application.PORTABLE).tei == fourteen
    )
    assert Radio.objects.create(tei=fifteen, application=Radio.Application.PORTABLE).tei == fifteen


def test_range_matching_compares_numeric_hex_values_across_lengths():
    model = RadioModel.objects.create(
        manufacturer="Source", name="Confirmed portable", application=Radio.Application.PORTABLE
    )
    TeiRange.objects.create(model=model, start_tei="0000000000000F", end_tei="000000000000010")

    assert RadioModel.for_tei("0000000000000f") == model
    assert RadioModel.for_tei("000000000000010") == model
    assert RadioModel.for_tei("000000000000011") is None


def test_range_overlap_is_numeric_even_when_text_width_differs():
    model = RadioModel.objects.create(
        manufacturer="Source", name="Confirmed vehicle", application=Radio.Application.VEHICLE
    )
    TeiRange.objects.create(model=model, start_tei="0000000000000F", end_tei="000000000000010")

    with pytest.raises(ValidationError):
        TeiRange(
            model=model, start_tei="000000000000010", end_tei="000000000000011"
        ).full_clean()


@pytest.mark.parametrize("value", ["0000000000001", "0000000000000001", "not-a-tei"])
def test_tei_rejects_values_outside_confirmed_width_or_alphabet(value):
    radio = Radio(tei=value, application=Radio.Application.PORTABLE)

    with pytest.raises(ValidationError):
        radio.full_clean()
