from unittest.mock import Mock, patch

from cryptography.fernet import Fernet
from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone

from assets.models import RicCode, RicCodeVectorRelationship
from citygis.client import CityGISError
from citygis.models import (
    CityGISSyncState,
    Vector,
    VectorServiceHistory,
    VectorVehicleHistory,
    Vehicle,
)
from citygis.synchronization import synchronize_citygis_data
from citygis.tasks import refresh_citygis
from fireplan.crypto import encrypt_secret
from fireplan.models import FireplanCredential

TEST_KEY = Fernet.generate_key().decode("ascii")


class CityGISTaskTests(TestCase):
    def setUp(self):
        self.credential = Mock(
            login="operator",
            encrypted_password="encrypted-password",
            encrypted_cookies="encrypted-cookies",
        )
        self.credential.save = Mock()

    def test_refresh_fetches_both_sources_before_sync_and_persists_session_after(self):
        calls = []
        vehicles = [{"id": 1, "alphacode": "P8"}]
        vectors = [{"pResourceCode": "VEC-1", "Name": "P8", "StatusCode": "0"}]
        result = {"vehicles_added": 1, "vectors_added": 1}
        self.credential_query = Mock(first=Mock(return_value=self.credential))

        def fetch_vehicles(*_args):
            calls.append("fireplan")
            return vehicles, "new-session"

        def fetch_vectors(*_args):
            calls.append("resources")
            return vectors

        def sync(*args):
            calls.append("sync")
            self.assertEqual(args, (vehicles, vectors))
            return result

        def save(*_args, **_kwargs):
            calls.append("save-credentials")

        self.credential.save.side_effect = save
        with (
            patch(
                "citygis.tasks.FireplanCredential.objects.filter",
                return_value=self.credential_query,
            ),
            patch("citygis.tasks.decrypt_secret", side_effect=["plain-password", "plain-cookies"]),
            patch("citygis.tasks.encrypt_secret", return_value="encrypted-new-session"),
            patch("citygis.tasks.fetch_fireplan_vehicles", side_effect=fetch_vehicles),
            patch("citygis.tasks.fetch_resource_vectors", side_effect=fetch_vectors),
            patch("citygis.tasks.synchronize_citygis_data", side_effect=sync),
        ):
            response = refresh_citygis.run()

        self.assertEqual(calls, ["fireplan", "resources", "sync", "save-credentials"])
        self.assertEqual(self.credential.encrypted_cookies, "encrypted-new-session")
        state = CityGISSyncState.objects.get(pk=1)
        self.assertIsNotNone(state.last_attempted_at)
        self.assertIsNotNone(state.last_succeeded_at)
        self.assertEqual(state.last_error, "")
        self.assertEqual(response["vehicles_added"], 1)
        self.assertEqual(response["vectors_added"], 1)

    def test_source_failure_does_not_sync_or_persist_new_cookies_and_is_logged(self):
        synchronize_citygis_data(
            [{"id": 7, "alphacode": "P7", "plate": "1-AAA-007"}],
            [
                {
                    "Name": "P7",
                    "ResourceCode": "RESOURCE-7",
                    "pResourceCode": "VEC-7",
                    "pServiceAbbreviation": "AND",
                    "StatusCode": "0",
                }
            ],
        )
        vector = Vector.objects.get(vector_code="VEC-7")
        before = {
            "vector": (vector.pk, vector.service_id, vector.vehicle_id, vector.is_current),
            "service_history": list(
                VectorServiceHistory.objects.filter(vector=vector).values_list(
                    "pk", "service_id", "source_service_abbreviation", "observed_at", "ended_at"
                )
            ),
            "vehicle_history": list(
                VectorVehicleHistory.objects.filter(vector=vector).values_list(
                    "pk", "vehicle_id", "source_vehicle_name", "observed_at", "ended_at"
                )
            ),
            "vehicle": list(Vehicle.objects.values_list("pk", "fireplan_id", "plate")),
        }
        self.credential_query = Mock(first=Mock(return_value=self.credential))
        with (
            patch(
                "citygis.tasks.FireplanCredential.objects.filter",
                return_value=self.credential_query,
            ),
            patch("citygis.tasks.decrypt_secret", side_effect=["plain-password", "plain-cookies"]),
            patch("citygis.tasks.encrypt_secret") as encrypt,
            patch("citygis.tasks.fetch_fireplan_vehicles", return_value=([], "new-session")),
            patch(
                "citygis.tasks.fetch_resource_vectors",
                side_effect=CityGISError("resources source returned an error"),
            ),
            patch("citygis.tasks.synchronize_citygis_data") as sync,
            self.assertLogs("citygis.tasks", level="ERROR") as captured,
        ):
            with self.assertRaisesRegex(CityGISError, "resources source returned an error"):
                refresh_citygis.run()

        sync.assert_not_called()
        encrypt.assert_not_called()
        self.credential.save.assert_not_called()
        self.assertNotIn("plain-password", " ".join(captured.output))
        state = CityGISSyncState.objects.get(pk=1)
        self.assertEqual(state.last_error, "resources source returned an error")
        self.assertNotIn("plain-password", state.last_error)
        vector.refresh_from_db()
        self.assertEqual(
            (vector.pk, vector.service_id, vector.vehicle_id, vector.is_current), before["vector"]
        )
        self.assertEqual(
            list(
                VectorServiceHistory.objects.filter(vector=vector).values_list(
                    "pk", "service_id", "source_service_abbreviation", "observed_at", "ended_at"
                )
            ),
            before["service_history"],
        )
        self.assertEqual(
            list(
                VectorVehicleHistory.objects.filter(vector=vector).values_list(
                    "pk", "vehicle_id", "source_vehicle_name", "observed_at", "ended_at"
                )
            ),
            before["vehicle_history"],
        )
        self.assertEqual(
            list(Vehicle.objects.values_list("pk", "fireplan_id", "plate")), before["vehicle"]
        )

    def test_reconciliation_failure_does_not_persist_refreshed_credentials(self):
        query = Mock(first=Mock(return_value=self.credential))
        with (
            patch("citygis.tasks.FireplanCredential.objects.filter", return_value=query),
            patch("citygis.tasks.decrypt_secret", side_effect=["plain-password", "plain-cookies"]),
            patch("citygis.tasks.fetch_fireplan_vehicles", return_value=([], "new-session")),
            patch("citygis.tasks.fetch_resource_vectors", return_value=[]),
            patch(
                "citygis.tasks.synchronize_citygis_data",
                side_effect=ValueError("invalid snapshot"),
            ),
            patch("citygis.tasks.encrypt_secret") as encrypt,
            self.assertLogs("citygis.tasks", level="ERROR"),
        ):
            with self.assertRaisesRegex(ValueError, "invalid snapshot"):
                refresh_citygis.run()

        encrypt.assert_not_called()
        self.credential.save.assert_not_called()

    @override_settings(FIREPLAN_CREDENTIAL_KEY=TEST_KEY)
    def test_persistence_failure_rolls_back_source_history_and_session(self):
        credential = FireplanCredential.objects.create(
            login="operator",
            encrypted_password=encrypt_secret("test-password"),
            encrypted_cookies=encrypt_secret("old-session"),
        )
        vehicle_rows = [
            {
                "id": 41,
                "alphacode": "P8",
                "plate": "1-ABC-123",
                "utilisation": "Ambulance",
                "chassis": "VIN-41",
                "statut": "Actif",
            }
        ]
        vector_rows = [
            {
                "Name": "P8",
                "ResourceCode": "RESOURCE-1",
                "pResourceCode": "VEC-1",
                "pServiceAbbreviation": "AND",
                "StatusCode": "0",
                "LastStatusTimeUpdated": "Nov 15 2025 02:12:28:3766529PM",
            }
        ]
        synchronize_citygis_data(vehicle_rows, vector_rows)
        vector = Vector.objects.get(vector_code="VEC-1")
        code = RicCode.objects.create(ric_code="198702", adc_code="298702", alias="TASK")
        ric_link = RicCodeVectorRelationship.assign(code, vector)
        old_history = {
            "service": list(
                VectorServiceHistory.objects.filter(vector=vector).values_list(
                    "pk",
                    "service_id",
                    "source_service_abbreviation",
                    "source_effective_at",
                    "observed_at",
                    "ended_at",
                )
            ),
            "vehicle": list(
                VectorVehicleHistory.objects.filter(vector=vector).values_list(
                    "pk",
                    "vehicle_id",
                    "source_vehicle_name",
                    "source_effective_at",
                    "observed_at",
                    "ended_at",
                )
            ),
        }
        old_service = vector.service_id
        old_vehicle = vector.vehicle_id
        old_effective_cookie = credential.encrypted_cookies
        prior_success = timezone.now()
        CityGISSyncState.objects.update_or_create(
            pk=1,
            defaults={"last_succeeded_at": prior_success, "last_error": ""},
        )
        changed_vectors = [{**vector_rows[0], "Name": "P9", "pServiceAbbreviation": "NORTH"}]
        changed_vehicles = [
            {**vehicle_rows[0], "plate": "9-ZZZ-999"},
            {"id": 42, "alphacode": "P9", "plate": "2-DEF-456", "statut": "Actif"},
        ]

        with (
            patch(
                "citygis.tasks.fetch_fireplan_vehicles",
                return_value=(changed_vehicles, "new-session"),
            ),
            patch("citygis.tasks.fetch_resource_vectors", return_value=changed_vectors),
            patch("citygis.tasks.encrypt_secret", side_effect=RuntimeError("persistence failed")),
            self.assertRaisesRegex(RuntimeError, "persistence failed"),
        ):
            refresh_citygis.run()

        credential.refresh_from_db()
        vector.refresh_from_db()
        ric_link.refresh_from_db()
        state = CityGISSyncState.objects.get(pk=1)
        self.assertEqual(credential.encrypted_cookies, old_effective_cookie)
        self.assertEqual((vector.service_id, vector.vehicle_id), (old_service, old_vehicle))
        self.assertFalse(Vehicle.objects.filter(fireplan_id=42).exists())
        self.assertEqual(Vehicle.objects.get(fireplan_id=41).plate, "1-ABC-123")
        self.assertEqual(
            list(
                VectorServiceHistory.objects.filter(vector=vector).values_list(
                    "pk",
                    "service_id",
                    "source_service_abbreviation",
                    "source_effective_at",
                    "observed_at",
                    "ended_at",
                )
            ),
            old_history["service"],
        )
        self.assertEqual(
            list(
                VectorVehicleHistory.objects.filter(vector=vector).values_list(
                    "pk",
                    "vehicle_id",
                    "source_vehicle_name",
                    "source_effective_at",
                    "observed_at",
                    "ended_at",
                )
            ),
            old_history["vehicle"],
        )
        self.assertIsNone(ric_link.ended_at)
        self.assertEqual(state.last_succeeded_at, prior_success)

    def test_missing_fireplan_credentials_fail_before_network_access(self):
        query = Mock(first=Mock(return_value=None))
        with (
            patch("citygis.tasks.FireplanCredential.objects.filter", return_value=query),
            patch("citygis.tasks.fetch_fireplan_vehicles") as fetch,
            self.assertRaisesRegex(RuntimeError, "Stel eerst de Fireplan-inloggegevens in"),
        ):
            refresh_citygis.run()
        fetch.assert_not_called()

    def test_beat_schedules_citygis_refresh_and_persists_results(self):
        schedule = settings.CELERY_BEAT_SCHEDULE["citygis-refresh"]

        self.assertEqual(schedule["task"], "citygis.refresh")
        self.assertEqual(schedule["schedule"], 60.0)
        self.assertNotIn("options", schedule)
        self.assertFalse(refresh_citygis.ignore_result)
