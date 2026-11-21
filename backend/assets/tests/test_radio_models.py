import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from assets.models import Radio, RadioModel, TeiRange
from inventory.models import ManagedObject

pytestmark = pytest.mark.django_db


def test_radio_preserves_tei_text_and_can_exist_without_a_model():
    radio = Radio.objects.create(tei="00000000000000A", application=Radio.Application.PORTABLE)

    assert radio.tei == "00000000000000A"
    assert radio.model is None
    assert radio.managed_object.kind == ManagedObject.Kind.RADIO


def test_radio_tei_is_unique_and_fireplan_fields_are_optional():
    Radio.objects.create(tei="000000000000001", application=Radio.Application.FIXED)

    with pytest.raises(IntegrityError):
        Radio.objects.create(tei="000000000000001", application=Radio.Application.FIXED)


def test_tei_range_matches_inclusively_and_rejects_overlap():
    model = RadioModel.objects.create(
        manufacturer="Vendor", name="Portable X", application=Radio.Application.PORTABLE
    )
    TeiRange.objects.create(model=model, start_tei="000000000000010", end_tei="000000000000020")
    overlapping = TeiRange(model=model, start_tei="000000000000020", end_tei="000000000000030")

    assert model.for_tei("000000000000010")
    assert model.for_tei("000000000000020")
    assert model.for_tei("000000000000030") is None
    with pytest.raises(ValidationError):
        overlapping.full_clean()


def test_tei_range_rejects_invalid_or_reversed_bounds():
    model = RadioModel.objects.create(
        manufacturer="Vendor", name="Portable Y", application=Radio.Application.PORTABLE
    )

    with pytest.raises(ValidationError):
        TeiRange(model=model, start_tei="not-a-tei", end_tei="000000000000010").full_clean()
    with pytest.raises(ValidationError):
        TeiRange(model=model, start_tei="000000000000020", end_tei="000000000000010").full_clean()


def test_radio_rejects_non_tei_text_and_assigns_matching_configured_model():
    model = RadioModel.objects.create(
        manufacturer="Vendor", name="Portable Z", application=Radio.Application.PORTABLE
    )
    TeiRange.objects.create(model=model, start_tei="000000000000100", end_tei="000000000000200")
    radio = Radio(tei="000000000000150", application=Radio.Application.PORTABLE)

    with pytest.raises(ValidationError):
        Radio(tei="123", application=Radio.Application.PORTABLE).full_clean()
    radio.save()
    assert radio.model == model
