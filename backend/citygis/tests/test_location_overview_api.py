from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from assets.models import Pager, PagerType, Radio, RicCode, RicCodeVectorRelationship
from citygis.models import (
    Location,
    Service,
    Vector,
    VectorStatus,
    VectorStatusHistory,
    Vehicle,
)
from inventory.models import ManagedRelationship


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

    def test_overview_includes_active_pagers_and_vector_placed_radios_only(self):
        self.api.force_login(self.staff)
        pager_type = PagerType.objects.create(name="Overview pager")
        pager = Pager.objects.create(serial_number="OVR-PAGER", type=pager_type)
        old_pager = Pager.objects.create(serial_number="OVR-OLD-PAGER", type=pager_type)
        radio = Radio.objects.create(tei="123456789012345")
        other_radio = Radio.objects.create(tei="223456789012345")
        inactive_radio = Radio.objects.create(tei="323456789012345")
        for asset in (pager, radio):
            ManagedRelationship.objects.create(
                source=asset.managed_object,
                target=self.vector.managed_object,
                kind=ManagedRelationship.Kind.ASSIGNED_TO,
            )
        ManagedRelationship.objects.create(
            source=old_pager.managed_object,
            target=self.vector.managed_object,
            kind=ManagedRelationship.Kind.ASSIGNED_TO,
            ended_at=timezone.now(),
        )
        ManagedRelationship.objects.create(
            source=other_radio.managed_object,
            target=self.vehicle.managed_object,
            kind=ManagedRelationship.Kind.MOUNTED_IN,
        )
        ManagedRelationship.objects.create(
            source=inactive_radio.managed_object,
            target=self.vector.managed_object,
            kind=ManagedRelationship.Kind.ASSIGNED_TO,
            ended_at=timezone.now(),
        )
        ric = RicCode.objects.create(ric_code="OVR-RIC", adc_code="OVR-ADC", alias="secret")
        RicCodeVectorRelationship.objects.create(code=ric, vector=self.vector)

        response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        vector = response.json()["vectors"][0]
        self.assertEqual([row["serial_number"] for row in vector["pagers"]], ["OVR-PAGER"])
        self.assertEqual([row["tei"] for row in vector["radios"]], ["123456789012345"])
        self.assertNotIn("ric", str(vector).lower())
        self.assertNotIn("OVR-RIC", str(vector))

    def test_overview_without_status_history_marks_the_full_window_unknown(self):
        now = timezone.now().replace(microsecond=0)
        self.api.force_login(self.staff)

        with patch("citygis.views.timezone.now", return_value=now):
            response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        vector = response.json()["vectors"][0]
        self.assertEqual(len(vector["status_periods"]), 1)
        self.assertIsNone(vector["status_periods"][0]["status_code"])
        self.assertTrue(vector["status_periods"][0]["is_unknown"])
        self.assertEqual(
            vector["status_periods"][0]["starts_at"],
            (now - timedelta(hours=24)).isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            vector["status_periods"][0]["ends_at"], now.isoformat().replace("+00:00", "Z")
        )
        self.assertEqual(vector["status_periods"][0]["duration_seconds"], 24 * 3600)

    def test_overview_treats_a_blank_status_episode_as_unknown(self):
        now = timezone.now().replace(microsecond=0)
        VectorStatusHistory.objects.create(
            vector=self.vector,
            status_code="",
            observed_at=now - timedelta(hours=2),
        )
        self.api.force_login(self.staff)

        with patch("citygis.views.timezone.now", return_value=now):
            response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        periods = response.json()["vectors"][0]["status_periods"]
        self.assertTrue(all(period["is_unknown"] for period in periods))

    def test_overview_clips_history_and_fills_unknown_gaps_in_the_last_24_hours(self):
        now = timezone.now().replace(microsecond=0)
        start = now - timedelta(hours=24)
        middle = now - timedelta(hours=12)
        VectorStatusHistory.objects.create(
            vector=self.vector,
            status_code="OLD",
            observed_at=start - timedelta(hours=8),
            source_effective_at=start - timedelta(hours=8),
            ended_at=start - timedelta(hours=4),
        )
        VectorStatusHistory.objects.create(
            vector=self.vector,
            status_code="KNOWN",
            observed_at=middle + timedelta(minutes=5),
            source_effective_at=middle,
            ended_at=now + timedelta(hours=1),
        )

        self.api.force_login(self.staff)
        with patch("citygis.views.timezone.now", return_value=now):
            response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        vector = response.json()["vectors"][0]
        self.assertEqual(vector["status_periods"][0]["is_unknown"], True)
        self.assertEqual(
            vector["status_periods"][0]["starts_at"],
            start.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            vector["status_periods"][0]["ends_at"],
            middle.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(vector["status_periods"][1]["status_code"], "KNOWN")
        self.assertEqual(
            vector["status_periods"][1]["starts_at"],
            middle.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            vector["status_periods"][1]["ends_at"],
            now.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            sum(row["duration_seconds"] for row in vector["status_periods"]), 24 * 3600
        )

    def test_overview_history_is_not_limited_to_fifty_rows_and_uses_observed_time_fallback(self):
        now = timezone.now().replace(microsecond=0)
        start = now - timedelta(hours=24)
        for index in range(60):
            period_start = start + timedelta(minutes=index * 20)
            VectorStatusHistory.objects.create(
                vector=self.vector,
                status_code=f"{index % 10:02d}",
                observed_at=period_start,
                source_effective_at=None,
                ended_at=period_start + timedelta(minutes=20),
            )

        self.api.force_login(self.staff)
        with patch("citygis.views.timezone.now", return_value=now):
            response = self.api.get(reverse("location-overview", args=[self.post.pk]))

        periods = response.json()["vectors"][0]["status_periods"]
        self.assertEqual(len(periods), 61)
        self.assertEqual(periods[0]["status_code"], "00")
        self.assertEqual(periods[0]["starts_at"], start.isoformat().replace("+00:00", "Z"))

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
