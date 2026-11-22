import pytest
from django.db import IntegrityError, transaction

from assets.models import Issi, Organization, Radio, RadioSubscription

pytestmark = pytest.mark.django_db


def make_radio(tei: str) -> Radio:
    return Radio.objects.create(tei=tei)


def test_issi_and_radio_can_exist_independently():
    radio = make_radio("000000000000001")
    organization = Organization.objects.create(name="Brandweer Brussel")
    issi = Issi.objects.create(issi="0000123456", alias="Ploeg A", organization=organization)
    free_issi = Issi.objects.create(issi="0000123457", alias="Reserve")
    free_radio = make_radio("000000000000002")

    assert radio.subscription_history.count() == 0
    assert issi.subscription_history.count() == 0
    assert free_issi.organization is None
    assert free_radio.subscription_history.count() == 0


def test_subscription_replacement_closes_history_on_both_sides():
    first_radio = make_radio("000000000000003")
    second_radio = make_radio("000000000000004")
    first_issi = Issi.objects.create(issi="0000000003", alias="First")
    second_issi = Issi.objects.create(issi="0000000004", alias="Second")

    first = RadioSubscription.assign(first_radio, first_issi)
    assert RadioSubscription.assign(first_radio, first_issi) == first
    RadioSubscription.assign(second_radio, second_issi)
    current = RadioSubscription.assign(first_radio, second_issi)

    first.refresh_from_db()
    assert first.ended_at is not None
    assert RadioSubscription.objects.filter(radio=second_radio, ended_at__isnull=False).exists()
    assert current.ended_at is None
    assert RadioSubscription.objects.filter(radio=first_radio, ended_at__isnull=True).count() == 1
    assert RadioSubscription.objects.filter(issi=second_issi, ended_at__isnull=True).count() == 1


def test_database_constraints_allow_only_one_active_subscription_per_radio_or_issi():
    first_radio = make_radio("000000000000005")
    second_radio = make_radio("000000000000006")
    first_issi = Issi.objects.create(issi="0000000005", alias="First")
    second_issi = Issi.objects.create(issi="0000000006", alias="Second")
    RadioSubscription.objects.create(radio=first_radio, issi=first_issi)

    with pytest.raises(IntegrityError), transaction.atomic():
        RadioSubscription.objects.create(radio=first_radio, issi=second_issi)
    with pytest.raises(IntegrityError), transaction.atomic():
        RadioSubscription.objects.create(radio=second_radio, issi=first_issi)
