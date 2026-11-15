from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from assets.models import Pager, PagerType, RicCode, RicCodeVectorRelationship
from citygis.models import Location, Service, Vector, Vehicle
from inventory.models import ManagedRelationship


class InventoryAPITests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.staff = user_model.objects.create_user(
            username="inventory-staff", password="test-pass", is_staff=True
        )
        self.user = user_model.objects.create_user(username="inventory-user", password="test-pass")
        self.api = APIClient()
        self.service = Service.objects.create(abbreviation="AND")
        self.post = Location.objects.create(
            name="Post Anderlecht", kind=Location.Kind.POST, service=self.service
        )
        self.other_service = Service.objects.create(abbreviation="DISP")
        self.other_location = Location.objects.create(
            name="Dispatch", kind=Location.Kind.ROOM, service=self.other_service
        )
        self.vehicle = Vehicle.objects.create(
            fireplan_id=41, alphacode="P8", plate="1-ABC-123", fleet_status="Actief"
        )
        self.vector = Vector.objects.create(
            vector_code="VEC-1",
            name="P8",
            service_abbreviation="AND",
            service=self.service,
            vehicle=self.vehicle,
            source_vehicle_name="P8",
            is_current=True,
        )
        self.unmapped_vector = Vector.objects.create(
            vector_code="VEC-2",
            name="Dispatch",
            service_abbreviation="DISP",
            service=self.other_service,
            is_current=True,
        )
        self.pager_type = PagerType.objects.create(name="TETRA")
        self.pager = Pager.objects.create(serial_number="SN-1", type=self.pager_type)
        self.ric_code = RicCode.objects.create(ric_code="123456", adc_code="234567", alias="AND")

    def test_staff_snapshot_contains_locations_source_projection_and_active_links(self):
        ManagedRelationship.assign_operationally(
            self.pager.managed_object, self.vector.managed_object
        )
        RicCodeVectorRelationship.assign(self.ric_code, self.vector)
        self.api.force_login(self.staff)

        response = self.api.get(reverse("inventory-snapshot"))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            {location["id"] for location in data["locations"]},
            {
                self.post.pk,
                self.other_location.pk,
            },
        )
        vectors = {row["id"]: row for row in data["vectors"]}
        self.assertEqual(vectors[self.vector.pk]["post"]["id"], self.post.pk)
        self.assertEqual(vectors[self.vector.pk]["vehicle"]["fireplan_id"], 41)
        self.assertIsNone(vectors[self.unmapped_vector.pk]["post"])
        pagers = {row["id"]: row for row in data["pagers"]}
        self.assertEqual(pagers[self.pager.pk]["assigned_vector_id"], self.vector.pk)
        codes = {row["id"]: row for row in data["ric_codes"]}
        self.assertEqual(codes[self.ric_code.pk]["vector_id"], self.vector.pk)

    def test_inventory_api_requires_staff(self):
        self.api.force_login(self.user)

        response = self.api.get(reverse("inventory-snapshot"))

        self.assertEqual(response.status_code, 403)

    def test_pager_assignment_is_idempotent_reassignable_and_unassignable(self):
        other_vector = Vector.objects.create(vector_code="VEC-3", is_current=True)
        self.api.force_login(self.staff)
        url = reverse("inventory-pager-vector", args=[self.pager.pk])

        first = self.api.put(url, {"vector_id": self.vector.pk}, format="json")
        relation = ManagedRelationship.objects.get(source=self.pager.managed_object)
        started_at = relation.started_at
        repeated = self.api.put(url, {"vector_id": self.vector.pk}, format="json")
        moved = self.api.put(url, {"vector_id": other_vector.pk}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(moved.status_code, 200)
        relation.refresh_from_db()
        self.assertEqual(relation.started_at, started_at)
        self.assertIsNotNone(relation.ended_at)
        current = ManagedRelationship.objects.get(
            source=self.pager.managed_object, ended_at__isnull=True
        )
        self.assertEqual(current.target_id, other_vector.managed_object_id)
        cleared = self.api.put(url, {"vector_id": None}, format="json")
        self.assertEqual(cleared.status_code, 200)
        self.assertFalse(
            ManagedRelationship.objects.filter(
                source=self.pager.managed_object, ended_at__isnull=True
            ).exists()
        )

    def test_pager_assignment_rejects_non_vector_or_source_fields(self):
        self.api.force_login(self.staff)
        url = reverse("inventory-pager-vector", args=[self.pager.pk])

        invalid_vector = self.api.put(url, {"vector_id": 99999}, format="json")
        source_edit = self.api.put(
            url, {"vector_id": self.vector.pk, "service_abbreviation": "LOCAL"}, format="json"
        )

        self.assertEqual(invalid_vector.status_code, 400)
        self.assertEqual(source_edit.status_code, 400)
        self.assertFalse(
            ManagedRelationship.objects.filter(source=self.pager.managed_object).exists()
        )

    def test_ric_code_assignment_keeps_history_when_moved_and_cleared(self):
        other_vector = Vector.objects.create(vector_code="VEC-3", is_current=True)
        self.api.force_login(self.staff)
        url = reverse("inventory-ric-vector", args=[self.ric_code.pk])

        first = self.api.put(url, {"vector_id": self.vector.pk}, format="json")
        original = RicCodeVectorRelationship.objects.get(code=self.ric_code)
        started_at = original.started_at
        repeated = self.api.put(url, {"vector_id": self.vector.pk}, format="json")
        moved = self.api.put(url, {"vector_id": other_vector.pk}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(moved.status_code, 200)
        original.refresh_from_db()
        self.assertEqual(original.started_at, started_at)
        self.assertIsNotNone(original.ended_at)
        current = RicCodeVectorRelationship.objects.get(code=self.ric_code, ended_at__isnull=True)
        self.assertEqual(current.vector_id, other_vector.pk)
        cleared = self.api.put(url, {"vector_id": None}, format="json")
        self.assertEqual(cleared.status_code, 200)
        self.assertFalse(
            RicCodeVectorRelationship.objects.filter(
                code=self.ric_code, ended_at__isnull=True
            ).exists()
        )

    def test_ric_code_assignment_rejects_invalid_vector_and_source_fields(self):
        self.api.force_login(self.staff)
        url = reverse("inventory-ric-vector", args=[self.ric_code.pk])

        invalid_vector = self.api.put(url, {"vector_id": 99999}, format="json")
        source_edit = self.api.put(
            url, {"vector_id": self.vector.pk, "vehicle_id": 99999}, format="json"
        )

        self.assertEqual(invalid_vector.status_code, 400)
        self.assertEqual(source_edit.status_code, 400)
        self.assertFalse(RicCodeVectorRelationship.objects.filter(code=self.ric_code).exists())
