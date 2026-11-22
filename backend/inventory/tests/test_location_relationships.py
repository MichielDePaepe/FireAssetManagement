import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from assets.models import Radio
from citygis.models import Location, Vector, Vehicle
from inventory.models import ManagedRelationship

pytestmark = pytest.mark.django_db


def test_radio_can_be_assigned_mounted_or_installed_with_distinct_targets():
    portable = Radio.objects.create(tei="000000000000101")
    mounted_radio = Radio.objects.create(tei="000000000000105")
    fixed_radio = Radio.objects.create(tei="000000000000106")
    vector = Vector.objects.create(vector_code="RADIO-ASSIGN")
    vehicle = Vehicle.objects.create(fireplan_id=99101, alphacode="RADIO-VEHICLE")
    post = Location.objects.create(name="Radio post", kind=Location.Kind.POST)

    assigned = ManagedRelationship.relate(
        portable.managed_object, ManagedRelationship.Kind.ASSIGNED_TO, target=vector.managed_object
    )
    mounted = ManagedRelationship.relate(
        mounted_radio.managed_object,
        ManagedRelationship.Kind.MOUNTED_IN,
        target=vehicle.managed_object,
    )
    installed = ManagedRelationship.relate(
        fixed_radio.managed_object,
        ManagedRelationship.Kind.INSTALLED_IN,
        target_location=post,
    )

    assert assigned.target_id == vector.managed_object_id
    assert mounted.target_id == vehicle.managed_object_id
    assert installed.target_location_id == post.pk


def test_relationship_requires_exactly_one_target():
    radio = Radio.objects.create(tei="000000000000102")
    post = Location.objects.create(name="Radio location")
    relation = ManagedRelationship(
        source=radio.managed_object,
        kind=ManagedRelationship.Kind.INSTALLED_IN,
        target_location=post,
    )
    relation.full_clean()

    with pytest.raises(ValidationError):
        ManagedRelationship(
            source=radio.managed_object, kind=ManagedRelationship.Kind.INSTALLED_IN
        ).full_clean()

    with pytest.raises(ValidationError):
        ManagedRelationship(
            source=radio.managed_object,
            target=radio.managed_object,
            target_location=post,
            kind=ManagedRelationship.Kind.INSTALLED_IN,
        ).full_clean()

    with pytest.raises(IntegrityError), transaction.atomic():
        ManagedRelationship.objects.create(
            source=radio.managed_object, kind=ManagedRelationship.Kind.INSTALLED_IN
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ManagedRelationship.objects.create(
            source=radio.managed_object,
            target=radio.managed_object,
            target_location=post,
            kind=ManagedRelationship.Kind.INSTALLED_IN,
        )


def test_radio_relationship_kinds_reject_incompatible_destinations():
    radio = Radio.objects.create(tei="000000000000103")
    vehicle = Vehicle.objects.create(fireplan_id=99103, alphacode="RADIO-INVALID")
    relation = ManagedRelationship(
        source=radio.managed_object,
        target=vehicle.managed_object,
        kind=ManagedRelationship.Kind.ASSIGNED_TO,
    )

    with pytest.raises(ValidationError):
        relation.full_clean()


def test_radio_relationship_replacement_keeps_previous_history():
    radio = Radio.objects.create(tei="000000000000104")
    first = Location.objects.create(name="First installation")
    second = Location.objects.create(name="Second installation")
    old = ManagedRelationship.relate(
        radio.managed_object,
        ManagedRelationship.Kind.INSTALLED_IN,
        target_location=first,
    )
    current = ManagedRelationship.relate(
        radio.managed_object,
        ManagedRelationship.Kind.INSTALLED_IN,
        target_location=second,
    )

    old.refresh_from_db()
    assert old.ended_at is not None
    assert current.ended_at is None
    assert current.target_location == second
