from importlib import import_module
from types import SimpleNamespace

import pytest
from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import connection

from assets.models import Manufacturer, Radio, RadioModel, TeiRange

pytestmark = pytest.mark.django_db


def test_radio_stores_fourteen_digit_tei_as_fifteen_and_preserves_fifteen():
    fourteen = "0" * 12 + "23"
    fifteen = "0" * 14 + "7"

    assert Radio.objects.create(tei=fourteen).tei == f"{fourteen}0"
    assert Radio.objects.create(tei=fifteen).tei == fifteen


def test_tei_range_normalizes_fourteen_digit_bounds_and_matches_both_search_forms():
    model = RadioModel.objects.create(
        manufacturer=Manufacturer.objects.get_or_create(name="Source")[0],
        name="Confirmed portable",
    )
    fourteen = "0" * 12 + "23"
    fifteen = f"{fourteen}0"
    end = "0" * 12 + "24"
    tei_range = TeiRange.objects.create(model=model, start_tei=fourteen, end_tei=end)

    assert tei_range.start_tei == fifteen
    assert tei_range.end_tei == f"{end}0"
    assert RadioModel.for_tei(fourteen) == model
    assert RadioModel.for_tei(fifteen) == model
    assert RadioModel.for_tei("0" * 12 + "25") is None


def test_range_overlap_uses_decimal_tei_values_after_normalization():
    model = RadioModel.objects.create(
        manufacturer=Manufacturer.objects.get_or_create(name="Source")[0],
        name="Confirmed vehicle",
    )
    start = "0" * 12 + "23"
    TeiRange.objects.create(model=model, start_tei=start, end_tei="0" * 12 + "24")

    with pytest.raises(ValidationError):
        TeiRange(model=model, start_tei=f"{start}0", end_tei="0" * 12 + "25").full_clean()


def test_data_migration_normalizes_existing_fourteen_digit_values():
    migration = import_module("assets.migrations.0016_normalize_tei_digits")
    radio = Radio.objects.create(tei="012345678901234")
    Radio.objects.filter(pk=radio.pk).update(tei="01234567890123")
    model = RadioModel.objects.create(
        manufacturer=Manufacturer.objects.get_or_create(name="Migration source")[0],
        name="Migration model",
    )
    tei_range = TeiRange.objects.create(
        model=model, start_tei="0" * 12 + "23", end_tei="0" * 12 + "24"
    )
    TeiRange.objects.filter(pk=tei_range.pk).update(
        start_tei="0" * 12 + "23", end_tei="0" * 12 + "24"
    )

    migration.normalize_existing_teis(apps, SimpleNamespace(connection=connection))

    radio.refresh_from_db()
    tei_range.refresh_from_db()
    assert radio.tei == "012345678901230"
    assert tei_range.start_tei == "0" * 12 + "230"
    assert tei_range.end_tei == "0" * 12 + "240"


@pytest.mark.parametrize("value", ["1234567890123", "0" * 16, "0" * 17, "not-a-tei", "0" * 14 + "A"])
def test_tei_rejects_non_decimal_or_unsupported_width(value):
    with pytest.raises(ValidationError):
        Radio(tei=value).full_clean()
