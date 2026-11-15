from django.db import models
from django.test import TestCase

from citygis.models import CityGISSyncState, Vector, VectorStatus, Vehicle

EXPECTED_STATUSES = [
    ("0", "Vrij", "Vrij", "#00FF00"),
    ("1", "Oproep basis/gealarmeerd", "Opr.basis", "#FFFF00"),
    ("15", "Opdracht andere NCU112", "Andere 112", "#00FFFF"),
    ("2", "Vertrek", "Vertrek", "#FF9900"),
    ("3", "Ter plaatse", "Ter pl.", "#FF0000"),
    ("4", "Vertrek ziekenhuis", "Vert.ZH.", "#FF00FF"),
    ("5", "Aankomst ziekenhuis", "Aank.ZH.", "#800080"),
    ("6", "Radiofonisch beschikbaar", "Radiof.bs.", "#0000FF"),
    ("7", "Telefonisch beschikbaar vertrekpunt", "Tel.bs.vp.", "#00FF00"),
    ("8", "Telefonisch beschikbaar elders", "Tel.bs.el.", "#008000"),
    ("9", "Buiten dienst", "Buiten d.", "#C0C0C0"),
    ("90", "Buitendienststelling - personeelstekort", "Pers", "#B8B4B4"),
    ("91", "Buitendienststelling - tech reden", "Tech", "#B8B4B4"),
    ("92", "Buitendienststelling - materiaal tekort", "Materiaal", "#B8B4B4"),
    ("93", "Buitendienststelling - buiten permanentieperiode", "Perm", "#D0CCCC"),
    ("98", "Geblokkeerd", "Blok", "#EEEEEE"),
    ("99", "Geprepositioneerd", "Prepos.", "#38714B"),
]


class CityGISModelTests(TestCase):
    def test_sync_state_stores_one_safe_last_attempt_and_success(self):
        field_names = {field.name for field in CityGISSyncState._meta.fields}

        self.assertTrue(
            {"last_attempted_at", "last_succeeded_at", "last_error"}.issubset(field_names)
        )
        self.assertEqual(CityGISSyncState._meta.pk.name, "id")

    def test_status_catalog_contains_only_the_four_requested_columns(self):
        business_fields = {
            field.name
            for field in VectorStatus._meta.get_fields()
            if isinstance(field, models.Field) and not field.auto_created
        }

        self.assertEqual(business_fields, {"code", "description", "abbreviation", "color"})

    def test_status_catalog_is_seeded_from_the_supplied_table(self):
        actual = list(
            VectorStatus.objects.order_by("code").values_list(
                "code", "description", "abbreviation", "color"
            )
        )

        self.assertEqual(actual, EXPECTED_STATUSES)

    def test_vehicle_has_unique_fireplan_identifier_and_current_source_tracking(self):
        self.assertTrue(Vehicle._meta.get_field("fireplan_id").unique)
        self.assertIsInstance(Vehicle._meta.get_field("is_current"), models.BooleanField)
        self.assertIsInstance(Vehicle._meta.get_field("last_seen_at"), models.DateTimeField)

    def test_vector_keeps_raw_string_status_and_current_source_tracking(self):
        self.assertIsInstance(Vector._meta.get_field("operational_status_code"), models.CharField)
        self.assertIsInstance(Vector._meta.get_field("is_current"), models.BooleanField)
        self.assertIsInstance(Vector._meta.get_field("last_seen_at"), models.DateTimeField)
        self.assertIsInstance(Vector._meta.get_field("vehicle"), models.OneToOneField)
