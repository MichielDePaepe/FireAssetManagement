from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from citygis.models import Location, Service, Vector, VectorStatus, Vehicle


class LocationOverviewAPITests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.staff = user_model.objects.create_user(
            username="overview-staff", password="test-pass", is_staff=True
        )
        self.user = user_model.objects.create_user(username="overview-user", password="test-pass")
        self.api = APIClient()
        self.service = Service.objects.create(abbreviation="OVERVIEW-A")
        self.free_service = Service.objects.create(abbreviation="OVERVIEW-FREE")
        self.post = Location.objects.create(
            name="Post A", kind=Location.Kind.POST, service=self.service
        )
        self.status = VectorStatus.objects.create(
            code="OVR", description="Operationeel", abbreviation="OP", color="#008000"
        )
        self.vehicle = Vehicle.objects.create(fireplan_id=908, alphacode="A1", plate="1-AAA-111")
        self.vector = Vector.objects.create(
            vector_code="OVR-1",
            service=self.service,
            service_abbreviation=self.service.abbreviation,
            operational_status_code=self.status.code,
            vehicle=self.vehicle,
            is_current=True,
        )
        self.stale_vector = Vector.objects.create(
            vector_code="OVR-OLD", service=self.service, is_current=False
        )
        self.no_service_location = Location.objects.create(
            name="Unmapped", kind=Location.Kind.POST
        )

    def test_staff_post_overview_includes_current_vectors_status_and_vehicle(self):
        self.api.force_login(self.staff)

        response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["location"]["service_id"], self.service.pk)
        self.assertEqual(data["service"]["abbreviation"], "OVERVIEW-A")
        self.assertEqual([row["id"] for row in data["vectors"]], [self.vector.pk])
        self.assertEqual(data["vectors"][0]["status_description"], "Operationeel")
        self.assertEqual(data["vectors"][0]["status_color"], "#008000")
        self.assertEqual(data["vectors"][0]["vehicle"]["fireplan_id"], 908)

    def test_staff_post_without_service_has_an_empty_overview(self):
        self.api.force_login(self.staff)

        response = self.api.get(reverse("location-overview", args=[self.no_service_location.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["service"])
        self.assertEqual(response.json()["vectors"], [])

    def test_location_overview_requires_staff(self):
        self.api.force_login(self.user)

        response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        self.assertEqual(response.status_code, 403)

    def test_staff_can_list_read_only_service_mapping_options(self):
        self.api.force_login(self.staff)

        response = self.api.get(reverse("location-service-options"))

        self.assertEqual(response.status_code, 200)
        services = {row["id"]: row for row in response.json()}
        self.assertEqual(
            services[self.service.pk],
            {
                "id": self.service.pk,
                "abbreviation": "OVERVIEW-A",
                "location_id": self.post.pk,
            },
        )
        self.assertEqual(
            services[self.free_service.pk],
            {"id": self.free_service.pk, "abbreviation": "OVERVIEW-FREE", "location_id": None},
        )

    def test_source_fields_cannot_be_changed_through_location_management(self):
        self.api.force_login(self.staff)

        response = self.api.patch(
            reverse("location-detail", args=[self.post.pk]),
            {"operational_status_code": "LOCAL", "vehicle_id": self.vehicle.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.vector.refresh_from_db()
        self.assertEqual(self.vector.operational_status_code, self.status.code)
        self.assertEqual(self.vector.vehicle_id, self.vehicle.pk)
