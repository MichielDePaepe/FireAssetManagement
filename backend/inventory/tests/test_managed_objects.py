import pytest

from assets.models import Pager, PagerType
from citygis.models import Vector, Vehicle
from inventory.models import ManagedObject

pytestmark = pytest.mark.django_db


def test_physical_and_operational_records_have_distinct_managed_object_types():
    pager = Pager.objects.create(serial_number="INV-100", type=PagerType.objects.first())
    vehicle = Vehicle.objects.create(fireplan_id=8100, alphacode="A-8100")
    vector = Vector.objects.create(vector_code="V-8100")

    assert pager.managed_object.kind == ManagedObject.Kind.PAGER
    assert vehicle.managed_object.kind == ManagedObject.Kind.VEHICLE
    assert vector.managed_object.kind == ManagedObject.Kind.VECTOR
    assert (
        len(
            {
                pager.managed_object_id,
                vehicle.managed_object_id,
                vector.managed_object_id,
            }
        )
        == 3
    )


def test_managed_object_metadata_is_included_in_typed_serializers():
    from assets.serializers import PagerSerializer
    from citygis.serializers import VectorSerializer, VehicleSerializer

    pager = Pager.objects.create(serial_number="INV-101", type=PagerType.objects.first())
    vehicle = Vehicle.objects.create(fireplan_id=8101, alphacode="A-8101")
    vector = Vector.objects.create(vector_code="V-8101")

    assert PagerSerializer(pager).data["managed_object"] == {
        "id": pager.managed_object_id,
        "kind": "pager",
    }
    assert VehicleSerializer(vehicle).data["managed_object"] == {
        "id": vehicle.managed_object_id,
        "kind": "vehicle",
    }
    assert VectorSerializer(vector).data["managed_object"] == {
        "id": vector.managed_object_id,
        "kind": "vector",
    }
