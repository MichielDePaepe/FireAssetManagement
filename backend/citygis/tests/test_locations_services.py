import pytest

from citygis.models import Location, Service, Vector
from citygis.synchronization import synchronize_citygis_data

pytestmark = pytest.mark.django_db


def test_locations_form_a_parent_hierarchy_and_can_map_services_to_posts():
    service = Service.objects.create(abbreviation="POST-N")
    post = Location.objects.create(name="Post Noord", kind=Location.Kind.POST, service=service)
    room = Location.objects.create(name="Dispatch", parent=post)

    assert room.parent == post
    assert post.service == service
    assert post.kind == Location.Kind.POST


def test_citygis_sync_normalizes_services_and_derives_only_mapped_posts():
    post_service = Service.objects.create(abbreviation="POST-N")
    post = Location.objects.create(name="Post Noord", kind=Location.Kind.POST, service=post_service)
    vector, _ = Vector.objects.get_or_create(vector_code="VEC-POST")
    original_id = vector.pk

    synchronize_citygis_data(
        [],
        [
            {
                "pResourceCode": "VEC-POST",
                "pServiceAbbreviation": "POST-N",
                "pName": "Ambulance",
                "ResourceCode": "RC-1",
            },
            {
                "pResourceCode": "VEC-UNMAPPED",
                "pServiceAbbreviation": "UNMAPPED",
                "pName": "Dispatch",
                "ResourceCode": "RC-2",
            },
        ],
    )

    vector.refresh_from_db()
    unmapped = Vector.objects.get(vector_code="VEC-UNMAPPED")
    assert vector.pk == original_id
    assert vector.service.abbreviation == "POST-N"
    assert vector.post == post
    assert vector.name == "Ambulance"
    assert vector.resource_code == "RC-1"
    assert unmapped.service.abbreviation == "UNMAPPED"
    assert unmapped.post is None
