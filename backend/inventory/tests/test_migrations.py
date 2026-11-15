from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class ManagedObjectMigrationTests(TransactionTestCase):
    migrate_from = [
        ("assets", "0007_seed_ric_codes"),
        ("citygis", "0003_sync_state"),
        ("inventory", "0001_initial"),
    ]
    migrate_to = [
        ("assets", "0009_riccodevectorrelationship"),
        ("citygis", "0005_locations_services"),
        ("inventory", "0002_physicallocationobservation_managedrelationship"),
    ]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def setUp(self):
        self.old_apps = self.migrate(self.migrate_from)

    def tearDown(self):
        self.migrate(self.migrate_to)

    def test_populated_records_are_preserved_and_typed_links_are_backfilled(self):
        PagerType = self.old_apps.get_model("assets", "PagerType")
        Pager = self.old_apps.get_model("assets", "Pager")
        RicCode = self.old_apps.get_model("assets", "RicCode")
        Vehicle = self.old_apps.get_model("citygis", "Vehicle")
        Vector = self.old_apps.get_model("citygis", "Vector")

        pager_type = PagerType.objects.create(name="Migration type")
        pager = Pager.objects.create(serial_number="MIG-100", type=pager_type)
        vehicle = Vehicle.objects.create(
            fireplan_id=70100,
            alphacode="MIG-V",
            plate="1-ABC-100",
            utilisation="Ambulance",
            chassis="CH-100",
            fleet_status="Active",
            is_current=True,
        )
        vector = Vector.objects.create(
            vector_code="MIG-VEC",
            service_abbreviation="MIG-SERVICE",
            resource_code="RESOURCE-100",
            source_vehicle_name="MIG-V",
            vehicle=vehicle,
            is_current=True,
        )
        code = RicCode.objects.create(ric_code="760799", adc_code="652799", alias="MIG POST")

        apps = self.migrate(self.migrate_to)
        ManagedObject = apps.get_model("inventory", "ManagedObject")
        current_pager = apps.get_model("assets", "Pager").objects.get(pk=pager.pk)
        current_vehicle = apps.get_model("citygis", "Vehicle").objects.get(pk=vehicle.pk)
        current_vector = apps.get_model("citygis", "Vector").objects.get(pk=vector.pk)

        self.assertEqual(current_pager.serial_number, "MIG-100")
        self.assertEqual(current_pager.managed_object.kind, "pager")
        self.assertEqual(current_vehicle.fireplan_id, 70100)
        self.assertEqual(current_vehicle.plate, "1-ABC-100")
        self.assertEqual(current_vehicle.managed_object.kind, "vehicle")
        self.assertEqual(current_vector.vector_code, "MIG-VEC")
        self.assertEqual(current_vector.vehicle_id, vehicle.pk)
        self.assertEqual(current_vector.service.abbreviation, "MIG-SERVICE")
        self.assertEqual(current_vector.managed_object.kind, "vector")
        self.assertEqual(
            apps.get_model("assets", "RicCode").objects.get(pk=code.pk).alias, "MIG POST"
        )
        self.assertEqual(ManagedObject.objects.count(), 3)

    def test_empty_asset_and_source_tables_migrate_without_creating_orphan_objects(self):
        apps = self.migrate(self.migrate_to)

        self.assertEqual(apps.get_model("inventory", "ManagedObject").objects.count(), 0)
        self.assertEqual(apps.get_model("assets", "Pager").objects.count(), 0)
        self.assertEqual(apps.get_model("citygis", "Vehicle").objects.count(), 0)
        self.assertEqual(apps.get_model("citygis", "Vector").objects.count(), 0)

    def test_active_assignment_constraint_rejects_duplicate_and_orphan_links(self):
        apps = self.migrate(self.migrate_to)
        ManagedObject = apps.get_model("inventory", "ManagedObject")
        Relationship = apps.get_model("inventory", "ManagedRelationship")
        source = ManagedObject.objects.create(kind="pager")
        target_a = ManagedObject.objects.create(kind="vector")
        target_b = ManagedObject.objects.create(kind="vehicle")
        Relationship.objects.create(source=source, target=target_a, kind="assigned_to")

        with self.assertRaises(IntegrityError), transaction.atomic():
            Relationship.objects.create(source=source, target=target_b, kind="assigned_to")

        with self.assertRaises(IntegrityError), transaction.atomic():
            Relationship.objects.create(
                source=source,
                target_id=99999999,
                kind="mounted_in",
            )
