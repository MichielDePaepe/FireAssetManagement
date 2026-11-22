from datetime import UTC, datetime

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CityGISRelationshipHistoryMigrationTests(TransactionTestCase):
    migrate_from = [("citygis", "0005_locations_services")]
    migrate_to = [("citygis", "0006_vectorservicehistory_vectorvehiclehistory")]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def setUp(self):
        self.old_apps = self.migrate(self.migrate_from)

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_populated_vectors_are_backfilled_without_guessing_effective_times(self):
        ManagedObject = self.old_apps.get_model("inventory", "ManagedObject")
        Service = self.old_apps.get_model("citygis", "Service")
        Vehicle = self.old_apps.get_model("citygis", "Vehicle")
        Vector = self.old_apps.get_model("citygis", "Vector")
        service = Service.objects.create(abbreviation="MIG-HISTORY-SERVICE")
        vehicle_object = ManagedObject.objects.create(kind="vehicle")
        vehicle = Vehicle.objects.create(
            managed_object_id=vehicle_object.pk,
            fireplan_id=6081,
            alphacode="MIG-HISTORY-VEHICLE",
        )
        vector_object = ManagedObject.objects.create(kind="vector")
        observed_at = datetime(2026, 11, 10, 11, 30, tzinfo=UTC)
        vector = Vector.objects.create(
            managed_object_id=vector_object.pk,
            vector_code="MIG-HISTORY-VECTOR",
            service=service,
            service_abbreviation=service.abbreviation,
            vehicle=vehicle,
            source_vehicle_name=vehicle.alphacode,
            last_seen_at=observed_at,
        )

        apps = self.migrate(self.migrate_to)
        current_vector = apps.get_model("citygis", "Vector").objects.get(pk=vector.pk)
        service_history = apps.get_model("citygis", "VectorServiceHistory").objects.get(
            vector_id=vector.pk
        )
        vehicle_history = apps.get_model("citygis", "VectorVehicleHistory").objects.get(
            vector_id=vector.pk
        )

        self.assertEqual(current_vector.vector_code, "MIG-HISTORY-VECTOR")
        self.assertEqual(current_vector.vehicle_id, vehicle.pk)
        self.assertEqual(service_history.service_id, service.pk)
        self.assertEqual(service_history.source_service_abbreviation, "MIG-HISTORY-SERVICE")
        self.assertEqual(vehicle_history.vehicle_id, vehicle.pk)
        self.assertEqual(vehicle_history.source_vehicle_name, "MIG-HISTORY-VEHICLE")
        self.assertEqual(service_history.observed_at, observed_at)
        self.assertEqual(vehicle_history.observed_at, observed_at)
        self.assertIsNone(service_history.source_effective_at)
        self.assertIsNone(vehicle_history.source_effective_at)

    def test_empty_vector_table_migrates_without_creating_history(self):
        apps = self.migrate(self.migrate_to)

        self.assertEqual(apps.get_model("citygis", "VectorServiceHistory").objects.count(), 0)
        self.assertEqual(apps.get_model("citygis", "VectorVehicleHistory").objects.count(), 0)
