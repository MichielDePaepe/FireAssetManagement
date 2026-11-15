from datetime import UTC, datetime

from django.test import TestCase
from django.utils import timezone

from assets.models import Pager, PagerType, RicCode, RicCodeVectorRelationship
from citygis.models import (
    Vector,
    VectorServiceHistory,
    VectorVehicleHistory,
    Vehicle,
)
from citygis.synchronization import synchronize_citygis_data
from inventory.models import ManagedRelationship


def vehicle_row(fireplan_id=41, alphacode="P8", **overrides):
    return {
        "id": fireplan_id,
        "alphacode": alphacode,
        "plate": "1-ABC-123",
        "utilisation": "Ambulance",
        "chassis": "VIN-41",
        "statut": "Actif",
        **overrides,
    }


def vector_row(vector_code="VEC-1", name="P8", status="15", **overrides):
    return {
        "Name": name,
        "ResourceCode": "RESOURCE-1",
        "pResourceCode": vector_code,
        "pName": "AP AND2",
        "pAbbreviation": "P-AND2",
        "pServiceAbbreviation": "AND",
        "pResourceTypeCode": "APM",
        "StatusCode": status,
        "LastStatusTimeUpdated": "Nov 15 2025 02:12:28:3766529PM",
        **overrides,
    }


class CityGISSynchronizationTests(TestCase):
    def test_sync_preserves_separate_codes_raw_status_and_status_timestamp(self):
        result = synchronize_citygis_data(
            [vehicle_row()],
            [vector_row()],
        )

        stored_vehicle = Vehicle.objects.get(fireplan_id=41)
        stored_vector = Vector.objects.get(vector_code="VEC-1")
        expected_time = datetime(2025, 11, 15, 14, 12, 28, 376652, tzinfo=UTC)
        self.assertEqual(result["vehicles_added"], 1)
        self.assertEqual(result["vectors_added"], 1)
        self.assertEqual(stored_vector.resource_code, "RESOURCE-1")
        self.assertNotEqual(stored_vector.resource_code, stored_vector.vector_code)
        self.assertEqual(stored_vector.operational_status_code, "15")
        self.assertEqual(stored_vector.status_updated_at, expected_time)
        self.assertEqual(stored_vector.source_vehicle_name, "P8")
        self.assertEqual(stored_vector.vehicle, stored_vehicle)
        self.assertTrue(stored_vehicle.is_current)
        self.assertTrue(stored_vector.is_current)
        self.assertIsNotNone(stored_vehicle.last_seen_at)
        self.assertIsNotNone(stored_vector.last_seen_at)

    def test_unmatched_vector_is_kept_without_a_vehicle_link(self):
        synchronize_citygis_data([vehicle_row()], [vector_row(name="UNKNOWN")])

        vector = Vector.objects.get(vector_code="VEC-1")
        self.assertIsNone(vector.vehicle)
        self.assertEqual(vector.source_vehicle_name, "UNKNOWN")

    def test_vector_without_vehicle_name_is_kept_unlinked(self):
        row = vector_row()
        row.pop("Name")

        synchronize_citygis_data([vehicle_row()], [row])

        vector = Vector.objects.get(vector_code="VEC-1")
        self.assertIsNone(vector.vehicle)
        self.assertEqual(vector.source_vehicle_name, "")

    def test_vector_without_status_is_kept_with_unknown_status_and_logged(self):
        row = vector_row()
        row.pop("StatusCode")

        with self.assertLogs("citygis.synchronization", level="ERROR") as captured:
            synchronize_citygis_data([vehicle_row()], [row])

        vector = Vector.objects.get(vector_code="VEC-1")
        self.assertEqual(vector.operational_status_code, "")
        self.assertIn("no valid operational status code", captured.records[0].getMessage())

    def test_duplicate_vector_matches_link_first_and_log_later_records(self):
        rows = [
            vector_row("VEC-FIRST"),
            vector_row("VEC-SECOND", status="3"),
        ]

        with self.assertLogs("citygis.synchronization", level="ERROR") as captured:
            result = synchronize_citygis_data([vehicle_row()], rows)

        self.assertEqual(Vector.objects.get(vector_code="VEC-FIRST").vehicle.alphacode, "P8")
        self.assertIsNone(Vector.objects.get(vector_code="VEC-SECOND").vehicle)
        self.assertEqual(captured.records[0].vector_code, "VEC-SECOND")
        self.assertEqual(captured.records[0].fireplan_id, 41)
        self.assertEqual(result["duplicate_vector_matches"], 1)
        self.assertEqual(
            VectorVehicleHistory.objects.get(vector__vector_code="VEC-FIRST").vehicle_id,
            Vector.objects.get(vector_code="VEC-FIRST").vehicle_id,
        )
        unmatched_history = VectorVehicleHistory.objects.get(vector__vector_code="VEC-SECOND")
        self.assertIsNone(unmatched_history.vehicle_id)
        self.assertEqual(unmatched_history.source_vehicle_name, "P8")

    def test_first_source_match_takes_over_an_existing_later_link(self):
        physical_vehicle = Vehicle.objects.create(fireplan_id=41, alphacode="P8")
        Vector.objects.create(vector_code="VEC-LATER", vehicle=physical_vehicle)

        synchronize_citygis_data(
            [vehicle_row()],
            [vector_row("VEC-FIRST"), vector_row("VEC-LATER")],
        )

        self.assertEqual(Vector.objects.get(vector_code="VEC-FIRST").vehicle, physical_vehicle)
        self.assertIsNone(Vector.objects.get(vector_code="VEC-LATER").vehicle)

    def test_successful_sync_marks_missing_records_and_reappearance_current(self):
        synchronize_citygis_data(
            [vehicle_row(41, "P8"), vehicle_row(42, "P9")],
            [vector_row("VEC-1", "P8"), vector_row("VEC-2", "P9")],
        )

        synchronize_citygis_data([vehicle_row(41, "P8")], [vector_row("VEC-1", "P8")])
        missing_vehicle = Vehicle.objects.get(fireplan_id=42)
        missing_vector = Vector.objects.get(vector_code="VEC-2")
        self.assertFalse(missing_vehicle.is_current)
        self.assertFalse(missing_vector.is_current)

        synchronize_citygis_data(
            [vehicle_row(41, "P8"), vehicle_row(42, "P9")],
            [vector_row("VEC-1", "P8"), vector_row("VEC-2", "P9")],
        )
        missing_vehicle.refresh_from_db()
        missing_vector.refresh_from_db()
        self.assertTrue(missing_vehicle.is_current)
        self.assertTrue(missing_vector.is_current)

    def test_invalid_snapshot_does_not_partially_update_existing_data(self):
        Vehicle.objects.create(fireplan_id=41, alphacode="P8", fleet_status="Actif")

        with self.assertRaises(ValueError):
            synchronize_citygis_data(
                [vehicle_row(41, "P8", statut="Rebuté"), vehicle_row(42, "P9")],
                [vector_row(), {"Name": "P9", "StatusCode": "0"}],
            )

        self.assertEqual(Vehicle.objects.count(), 1)
        self.assertEqual(Vehicle.objects.get(fireplan_id=41).fleet_status, "Actif")
        self.assertFalse(Vector.objects.exists())

    def test_first_sync_records_both_relationships_with_unknown_effective_time(self):
        before = timezone.now()

        synchronize_citygis_data([vehicle_row()], [vector_row()])

        vector = Vector.objects.get(vector_code="VEC-1")
        service_history = VectorServiceHistory.objects.get(vector=vector)
        vehicle_history = VectorVehicleHistory.objects.get(vector=vector)
        self.assertEqual(service_history.service, vector.service)
        self.assertEqual(service_history.source_service_abbreviation, "AND")
        self.assertEqual(vehicle_history.vehicle, vector.vehicle)
        self.assertEqual(vehicle_history.source_vehicle_name, "P8")
        for history in (service_history, vehicle_history):
            self.assertIsNone(history.source_effective_at)
            self.assertGreaterEqual(history.observed_at, before)
            self.assertIsNone(history.ended_at)

    def test_identical_snapshot_does_not_duplicate_or_retime_relationship_history(self):
        vehicles = [vehicle_row()]
        vectors = [vector_row()]
        synchronize_citygis_data(vehicles, vectors)
        service_time = VectorServiceHistory.objects.get().observed_at
        vehicle_time = VectorVehicleHistory.objects.get().observed_at

        synchronize_citygis_data(vehicles, vectors)

        self.assertEqual(VectorServiceHistory.objects.count(), 1)
        self.assertEqual(VectorVehicleHistory.objects.count(), 1)
        self.assertEqual(VectorServiceHistory.objects.get().observed_at, service_time)
        self.assertEqual(VectorVehicleHistory.objects.get().observed_at, vehicle_time)

    def test_status_timestamp_is_not_treated_as_a_relationship_effective_time(self):
        synchronize_citygis_data([vehicle_row()], [vector_row()])

        synchronize_citygis_data(
            [vehicle_row()],
            [vector_row(LastStatusTimeUpdated="Nov 15 2026 04:00:00:0000000PM")],
        )

        self.assertEqual(VectorServiceHistory.objects.count(), 1)
        self.assertEqual(VectorVehicleHistory.objects.count(), 1)
        self.assertIsNone(VectorServiceHistory.objects.get().source_effective_at)
        self.assertIsNone(VectorVehicleHistory.objects.get().source_effective_at)

    def test_fireplan_vehicle_update_preserves_managed_identity_and_vector_link(self):
        synchronize_citygis_data([vehicle_row()], [vector_row()])
        vehicle = Vehicle.objects.get(fireplan_id=41)
        vector = Vector.objects.get(vector_code="VEC-1")
        managed_object_id = vehicle.managed_object_id

        synchronize_citygis_data(
            [vehicle_row(plate="2-XYZ-456", utilisation="Pompier", statut="Actif")],
            [vector_row()],
        )

        vehicle.refresh_from_db()
        vector.refresh_from_db()
        self.assertEqual(vehicle.managed_object_id, managed_object_id)
        self.assertEqual(vehicle.plate, "2-XYZ-456")
        self.assertEqual(vehicle.utilisation, "Pompier")
        self.assertEqual(vector.vehicle_id, vehicle.pk)
        self.assertEqual(VectorVehicleHistory.objects.count(), 1)

    def test_source_sync_does_not_change_locally_managed_relationships(self):
        pager_type, _ = PagerType.objects.get_or_create(name="Local relation test type")
        pager = Pager.objects.create(serial_number="SYNC-LOCAL", type=pager_type)
        code = RicCode.objects.create(ric_code="198701", adc_code="298701", alias="LOCAL")
        synchronize_citygis_data([vehicle_row()], [vector_row()])
        vector = Vector.objects.get(vector_code="VEC-1")
        assignment = ManagedRelationship.assign_operationally(
            pager.managed_object, vector.managed_object
        )
        ric_link = RicCodeVectorRelationship.assign(code, vector)

        synchronize_citygis_data(
            [vehicle_row(41, "P8", plate="2-XYZ-456"), vehicle_row(42, "P9")],
            [vector_row(name="P9", pServiceAbbreviation="NORTH")],
        )

        assignment.refresh_from_db()
        ric_link.refresh_from_db()
        self.assertIsNone(assignment.ended_at)
        self.assertIsNone(ric_link.ended_at)
        self.assertEqual(assignment.target_id, vector.managed_object_id)
        self.assertEqual(ric_link.vector_id, vector.pk)

    def test_changed_service_and_vehicle_close_old_rows_and_open_new_rows(self):
        synchronize_citygis_data(
            [vehicle_row(41, "P8"), vehicle_row(42, "P9")],
            [vector_row(name="P8")],
        )
        prior_service = VectorServiceHistory.objects.get()
        prior_vehicle = VectorVehicleHistory.objects.get()

        synchronize_citygis_data(
            [vehicle_row(41, "P8"), vehicle_row(42, "P9")],
            [vector_row(name="P9", pServiceAbbreviation="NORTH")],
        )

        current_service = VectorServiceHistory.objects.get(ended_at__isnull=True)
        current_vehicle = VectorVehicleHistory.objects.get(ended_at__isnull=True)
        prior_service.refresh_from_db()
        prior_vehicle.refresh_from_db()
        self.assertIsNotNone(prior_service.ended_at)
        self.assertIsNotNone(prior_vehicle.ended_at)
        self.assertEqual(current_service.source_service_abbreviation, "NORTH")
        self.assertEqual(current_vehicle.vehicle.fireplan_id, 42)
        self.assertIsNone(current_service.source_effective_at)
        self.assertIsNone(current_vehicle.source_effective_at)
        self.assertEqual(VectorServiceHistory.objects.count(), 2)
        self.assertEqual(VectorVehicleHistory.objects.count(), 2)

    def test_unmatched_association_is_recorded_and_missing_vector_keeps_last_known_state(self):
        synchronize_citygis_data([vehicle_row()], [vector_row()])
        prior_vehicle = VectorVehicleHistory.objects.get(ended_at__isnull=True)

        synchronize_citygis_data(
            [vehicle_row()],
            [vector_row(name="UNKNOWN", pServiceAbbreviation="")],
        )

        current_vehicle = VectorVehicleHistory.objects.get(ended_at__isnull=True)
        current_service = VectorServiceHistory.objects.get(ended_at__isnull=True)
        self.assertIsNone(current_vehicle.vehicle)
        self.assertEqual(current_vehicle.source_vehicle_name, "UNKNOWN")
        self.assertIsNone(current_service.service)
        self.assertEqual(current_service.source_service_abbreviation, "")
        self.assertIsNotNone(VectorVehicleHistory.objects.get(pk=prior_vehicle.pk).ended_at)

        synchronize_citygis_data([vehicle_row()], [])
        current_vehicle.refresh_from_db()
        self.assertTrue(Vector.objects.get(vector_code="VEC-1").is_current is False)
        self.assertIsNone(current_vehicle.ended_at)

    def test_invalid_snapshot_does_not_close_existing_relationship_history(self):
        synchronize_citygis_data([vehicle_row()], [vector_row()])
        service_history = VectorServiceHistory.objects.get(ended_at__isnull=True)
        vehicle_history = VectorVehicleHistory.objects.get(ended_at__isnull=True)

        with self.assertRaises(ValueError):
            synchronize_citygis_data(
                [vehicle_row(41, "P8", statut="Rebuté")],
                [vector_row(), {"Name": "P9", "StatusCode": "0"}],
            )

        service_history.refresh_from_db()
        vehicle_history.refresh_from_db()
        self.assertIsNone(service_history.ended_at)
        self.assertIsNone(vehicle_history.ended_at)
        self.assertEqual(VectorServiceHistory.objects.count(), 1)
        self.assertEqual(VectorVehicleHistory.objects.count(), 1)
