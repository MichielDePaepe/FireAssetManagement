from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class ObservationRadioBackfillMigrationTests(TransactionTestCase):
    migrate_from = [
        ("assets", "0017_tei_length_fifteen"),
        ("fireplan", "0002_fireplaninventory_fireplanradioobservation"),
    ]
    migrate_to = [("fireplan", "0003_observation_asset_links")]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def setUp(self):
        self.old_apps = self.migrate(self.migrate_from)

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_backfills_valid_local_observations_without_rewriting_source_values(self):
        ManagedObject = self.old_apps.get_model("inventory", "ManagedObject")
        Radio = self.old_apps.get_model("assets", "Radio")
        Inventory = self.old_apps.get_model("fireplan", "FireplanInventory")
        Observation = self.old_apps.get_model("fireplan", "FireplanRadioObservation")

        radio14 = Radio.objects.create(
            managed_object=ManagedObject.objects.create(kind="radio"),
            tei="123456789012340",
        )
        radio15 = Radio.objects.create(
            managed_object=ManagedObject.objects.create(kind="radio"),
            tei="123456789012345",
        )
        inventory = Inventory.objects.create(uuid="migration-inventory")
        source_values = {
            "fourteen": "12345678901234",
            "fifteen": "123456789012345",
            "invalid": "١٢٣٤٥٦٧٨٩٠١٢٣٤",
            "unknown": "999999999999999",
        }
        for item_id, serial in source_values.items():
            Observation.objects.create(
                inventory=inventory,
                fireplan_item_id=item_id,
                item_type_id=1010,
                serial_number=serial,
            )

        apps = self.migrate(self.migrate_to)
        NewObservation = apps.get_model("fireplan", "FireplanRadioObservation")
        observations = {
            row.fireplan_item_id: row
            for row in NewObservation.objects.select_related("radio").order_by("fireplan_item_id")
        }

        self.assertEqual(observations["fourteen"].radio_id, radio14.pk)
        self.assertEqual(observations["fifteen"].radio_id, radio15.pk)
        self.assertIsNone(observations["invalid"].radio_id)
        self.assertIsNone(observations["unknown"].radio_id)
        self.assertEqual(observations["fourteen"].serial_number, source_values["fourteen"])
