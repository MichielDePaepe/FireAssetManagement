import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from assets.models import Manufacturer, Radio, RadioModel, TeiRange
from inventory.models import ManagedObject

pytestmark = pytest.mark.django_db


def test_radio_preserves_tei_text_and_can_exist_without_a_model():
    radio = Radio.objects.create(tei="000000000000009")

    assert radio.tei == "000000000000009"
    assert radio.model is None
    assert radio.managed_object.kind == ManagedObject.Kind.RADIO


def test_radio_tei_is_unique_and_fireplan_fields_are_optional():
    Radio.objects.create(tei="000000000000001")

    with pytest.raises(IntegrityError):
        Radio.objects.create(tei="000000000000001")


def test_tei_range_matches_inclusively_and_rejects_overlap():
    model = RadioModel.objects.create(
        manufacturer=Manufacturer.objects.get_or_create(name="Vendor")[0], name="Portable X"
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
        manufacturer=Manufacturer.objects.get_or_create(name="Vendor")[0], name="Portable Y"
    )

    with pytest.raises(ValidationError):
        TeiRange(model=model, start_tei="not-a-tei", end_tei="000000000000010").full_clean()
    with pytest.raises(ValidationError):
        TeiRange(model=model, start_tei="000000000000020", end_tei="000000000000010").full_clean()


def test_radio_rejects_non_tei_text_and_assigns_matching_configured_model():
    model = RadioModel.objects.create(
        manufacturer=Manufacturer.objects.get_or_create(name="Vendor")[0], name="Portable Z"
    )
    TeiRange.objects.create(model=model, start_tei="000000000000100", end_tei="000000000000200")
    radio = Radio(tei="000000000000150")

    with pytest.raises(ValidationError):
        Radio(tei="123").full_clean()
    radio.save()
    assert radio.model == model
