import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from citygis.models import CityGISSyncState, Location, Service, Vector, VectorStatus, Vehicle


class CityGISAPITests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.staff = user_model.objects.create_user(
            username="citygis-staff", password="test-pass", is_staff=True
        )
        self.user = user_model.objects.create_user(username="citygis-user", password="test-pass")
        self.api = APIClient()

    def test_staff_snapshot_includes_catalog_values_and_vector_vehicle_link(self):
        service = Service.objects.create(abbreviation="AND")
        post = Location.objects.create(
            name="Post Anderlecht", kind=Location.Kind.POST, service=service
        )
        vehicle = Vehicle.objects.create(
            fireplan_id=41,
            alphacode="P8",
            plate="1-ABC-123",
            fleet_status="Actif",
        )
        VectorStatus.objects.get(code="15")
        CityGISSyncState.objects.create(
            pk=1,
            last_attempted_at=timezone.make_aware(datetime(2025, 11, 15, 14, 13, 0)),
            last_succeeded_at=timezone.make_aware(datetime(2025, 11, 15, 14, 12, 28)),
            last_error="CityGIS-bronnen konden niet worden opgehaald of verwerkt.",
        )
        Vector.objects.create(
            vector_code="VEC-1",
            name="AP AND2",
            abbreviation="P-AND2",
            service_abbreviation="AND",
            service=service,
            resource_type_code="APM",
            resource_code="RESOURCE-1",
            operational_status_code="15",
            status_updated_at=timezone.make_aware(datetime(2025, 11, 15, 14, 12, 28)),
            vehicle=vehicle,
            source_vehicle_name="P8",
            is_current=True,
        )
        self.api.force_login(self.staff)

        response = self.api.get(reverse("citygis-data"))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        vector = data["vectors"][0]
        self.assertEqual(vector["operational_status_code"], "15")
        self.assertEqual(vector["status_description"], "Opdracht andere NCU112")
        self.assertEqual(vector["status_color"], "#00FFFF")
        self.assertEqual(vector["vehicle"]["fireplan_id"], 41)
        self.assertEqual(vector["vehicle"]["managed_object"]["kind"], "vehicle")
        self.assertEqual(vector["managed_object"]["kind"], "vector")
        self.assertEqual(vector["service"]["abbreviation"], "AND")
        self.assertEqual(vector["post"]["id"], post.pk)
        self.assertEqual(vector["resource_code"], "RESOURCE-1")
        self.assertEqual(set(data["statuses"][0]), {"code", "description", "abbreviation", "color"})
        self.assertEqual(
            data["sync_state"]["last_error"],
            "CityGIS-bronnen konden niet worden opgehaald of verwerkt.",
        )
        self.assertEqual(
            datetime.fromisoformat(data["last_refreshed_at"].replace("Z", "+00:00")),
            timezone.make_aware(datetime(2025, 11, 15, 14, 12, 28)),
        )

    def test_snapshot_denies_non_staff_users(self):
        self.api.force_login(self.user)

        response = self.api.get(reverse("citygis-data"))

        self.assertEqual(response.status_code, 403)

    def test_citygis_source_snapshot_is_read_only(self):
        self.api.force_login(self.staff)

        response = self.api.patch(
            reverse("citygis-data"),
            {"vectors": [{"vector_code": "VEC-1", "service_abbreviation": "LOCAL"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 405)

    def test_manual_refresh_queues_celery_task_for_staff_only(self):
        self.api.force_login(self.staff)
        with patch("citygis.views.refresh_citygis.apply_async") as apply_async:
            apply_async.return_value.id = "citygis-task-123"
            response = self.api.post(reverse("citygis-refresh"), data={}, format="json")

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["task_id"], "citygis-task-123")
        apply_async.assert_called_once_with()

        self.api.force_login(self.user)
        response = self.api.post(reverse("citygis-refresh"), data={}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_citygis_task_is_exposed_by_existing_task_detail_allowlist(self):
        self.api.force_login(self.staff)
        snapshot = {
            "task_id": "citygis-task-123",
            "task_name": "citygis.refresh",
            "status": "SUCCESS",
            "progress": None,
            "result": {"vectors_added": 1},
            "error": None,
            "updated_at": None,
        }
        with patch("tasks.views.task_snapshot", return_value=snapshot):
            response = self.api.get(reverse("task-detail", args=["citygis-task-123"]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["vectors_added"], 1)

    def test_sse_rejects_anonymous_and_non_staff_users(self):
        path = reverse("citygis-events")
        self.assertEqual(Client().get(path).status_code, 401)

        self.api.force_login(self.user)
        self.assertEqual(self.api.get(path).status_code, 403)

    def test_sse_sends_initial_and_changed_snapshot_including_new_link(self):
        self.api.force_login(self.staff)
        first = {
            "vehicles": [{"fireplan_id": 41}],
            "vectors": [{"vector_code": "VEC-1", "vehicle": None}],
            "statuses": [],
            "last_refreshed_at": "2025-11-15T14:12:28+01:00",
        }
        changed = {
            **first,
            "vectors": [{"vector_code": "VEC-1", "vehicle": {"fireplan_id": 41}}],
        }
        response = self.api.get(reverse("citygis-events"))

        async def read_three_chunks():
            iterator = response.streaming_content
            chunks = [await anext(iterator) for _ in range(3)]
            await iterator.aclose()
            return chunks

        with (
            patch(
                "citygis.views.async_citygis_snapshot",
                new=AsyncMock(side_effect=[first, changed]),
            ),
            patch("citygis.views.asyncio.sleep", new=AsyncMock(return_value=None)),
        ):
            chunks = asyncio.run(read_three_chunks())

        events = [chunk.decode() for chunk in chunks if b"event: citygis" in chunk]
        self.assertEqual(len(events), 2)
        snapshots = [json.loads(event.split("data: ", 1)[1]) for event in events]
        self.assertIsNone(snapshots[0]["vectors"][0]["vehicle"])
        self.assertEqual(snapshots[1]["vectors"][0]["vehicle"]["fireplan_id"], 41)
