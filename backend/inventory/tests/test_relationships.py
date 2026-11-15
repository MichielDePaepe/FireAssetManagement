from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import close_old_connections, connections

from assets.models import Pager, PagerType
from citygis.models import Location, Service, Vector, Vehicle
from inventory.models import ManagedObject, ManagedRelationship, PhysicalLocationObservation

pytestmark = pytest.mark.django_db


def test_operational_assignment_retains_history_and_derives_expected_location():
    pager = Pager.objects.create(serial_number="REL-100", type=PagerType.objects.first())
    first_service = Service.objects.create(abbreviation="POST-A")
    first_post = Location.objects.create(
        name="Post A", kind=Location.Kind.POST, service=first_service
    )
    first_vector = Vector.objects.create(vector_code="VEC-A", service=first_service)
    first_vehicle = Vehicle.objects.create(fireplan_id=9971, alphacode="A-9971")
    first_vector.vehicle = first_vehicle
    first_vector.save()
    second_service = Service.objects.create(abbreviation="POST-B")
    second_post = Location.objects.create(
        name="Post B", kind=Location.Kind.POST, service=second_service
    )
    second_vector = Vector.objects.create(vector_code="VEC-B", service=second_service)
    second_vehicle = Vehicle.objects.create(fireplan_id=9972, alphacode="A-9972")
    second_vector.vehicle = second_vehicle
    second_vector.save()

    first_assignment = ManagedRelationship.assign_operationally(
        pager.managed_object, first_vector.managed_object
    )
    assert first_vector.post == first_post
    observation = PhysicalLocationObservation.objects.create(
        asset=pager.managed_object, location=second_post
    )

    assert pager.managed_object.expected_location == first_vehicle.managed_object
    assert observation.location == second_post

    second_assignment = ManagedRelationship.assign_operationally(
        pager.managed_object, second_vector.managed_object
    )

    first_assignment.refresh_from_db()
    assert first_assignment.ended_at is not None
    assert second_assignment.ended_at is None
    assert pager.managed_object.expected_location == second_vehicle.managed_object
    assert PhysicalLocationObservation.objects.filter(asset=pager.managed_object).count() == 1


def test_explicit_relationships_can_connect_eligible_object_types():
    vehicle = Vehicle.objects.create(fireplan_id=9900, alphacode="A-9900")
    vector = Vector.objects.create(vector_code="VEC-9900")

    relationship = ManagedRelationship.objects.create(
        source=vector.managed_object,
        target=vehicle.managed_object,
        kind=ManagedRelationship.Kind.MOUNTED_IN,
    )

    assert relationship.source.kind == ManagedObject.Kind.VECTOR
    assert relationship.target.kind == ManagedObject.Kind.VEHICLE


def test_ric_code_can_move_between_vectors_without_losing_history():
    from assets.models import RicCode, RicCodeVectorRelationship

    code = RicCode.objects.create(ric_code="760701", adc_code="652701", alias="POST A")
    first_vector = Vector.objects.create(vector_code="VEC-RIC-A")
    second_vector = Vector.objects.create(vector_code="VEC-RIC-B")

    first = RicCodeVectorRelationship.assign(code, first_vector)
    second = RicCodeVectorRelationship.assign(code, second_vector)

    first.refresh_from_db()
    assert first.ended_at is not None
    assert second.ended_at is None
    assert list(
        code.vector_relationships.filter(ended_at__isnull=True).values_list("vector_id", flat=True)
    ) == [second_vector.pk]


@pytest.mark.django_db(transaction=True)
def test_concurrent_operational_assignments_leave_one_active_relationship():
    import threading

    pager_type, _ = PagerType.objects.get_or_create(name="Concurrency test pager")
    pager = Pager.objects.create(serial_number="REL-CONCURRENT", type=pager_type)
    targets = [
        Vector.objects.create(vector_code=f"VEC-CONCURRENT-{number}").managed_object
        for number in range(2)
    ]
    barrier = threading.Barrier(2)

    def assign(target_id):
        close_old_connections()
        try:
            source = ManagedObject.objects.get(pk=pager.managed_object_id)
            target = ManagedObject.objects.get(pk=target_id)
            barrier.wait(timeout=5)
            ManagedRelationship.assign_operationally(source, target)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(assign, [target.pk for target in targets]))

    assignments = ManagedRelationship.objects.filter(
        source=pager.managed_object,
        kind=ManagedRelationship.Kind.ASSIGNED_TO,
    )
    assert assignments.filter(ended_at__isnull=True).count() == 1
    assert assignments.count() == 2


def test_multiple_ric_codes_can_share_one_vector():
    from assets.models import RicCode, RicCodeVectorRelationship

    vector = Vector.objects.create(vector_code="VEC-MULTIPLE-RIC")
    codes = [
        RicCode.objects.create(ric_code=f"76070{n}", adc_code=f"65270{n}", alias=f"POST {n}")
        for n in range(2)
    ]

    for code in codes:
        RicCodeVectorRelationship.assign(code, vector)

    assert vector.ric_code_relationships.filter(ended_at__isnull=True).count() == 2
