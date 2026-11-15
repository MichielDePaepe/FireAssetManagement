import django.db.models.deletion
from django.db import migrations, models

STATUS_ROWS = [
    ("0", "Vrij", "Vrij", True, True, False, 0, True, "#00FF00"),
    ("1", "Oproep basis/gealarmeerd", "Opr.basis", False, True, False, 3, True, "#FFFF00"),
    ("15", "Opdracht andere NCU112", "Andere 112", False, True, False, 3, True, "#00FFFF"),
    ("2", "Vertrek", "Vertrek", False, True, False, 3, True, "#FF9900"),
    ("3", "Ter plaatse", "Ter pl.", False, True, False, 3, True, "#FF0000"),
    ("4", "Vertrek ziekenhuis", "Vert.ZH.", False, True, True, 3, True, "#FF00FF"),
    ("5", "Aankomst ziekenhuis", "Aank.ZH.", False, True, True, 3, True, "#800080"),
    ("6", "Radiofonisch beschikbaar", "Radiof.bs.", True, True, False, 3, True, "#0000FF"),
    (
        "7",
        "Telefonisch beschikbaar vertrekpunt",
        "Tel.bs.vp.",
        True,
        True,
        False,
        0,
        True,
        "#00FF00",
    ),
    ("8", "Telefonisch beschikbaar elders", "Tel.bs.el.", True, True, False, 0, False, "#008000"),
    ("9", "Buiten dienst", "Buiten d.", False, True, False, 0, True, "#C0C0C0"),
    (
        "90",
        "Buitendienststelling - personeelstekort",
        "Pers",
        False,
        True,
        False,
        0,
        True,
        "#B8B4B4",
    ),
    (
        "91",
        "Buitendienststelling - technische reden",
        "Tech",
        False,
        True,
        False,
        0,
        True,
        "#B8B4B4",
    ),
    (
        "92",
        "Buitendienststelling - materiaaltekort",
        "Materiaal",
        False,
        True,
        False,
        0,
        True,
        "#B8B4B4",
    ),
    (
        "93",
        "Buitendienststelling - buiten permanentieperiode",
        "Perm",
        False,
        True,
        False,
        0,
        True,
        "#D0CCCC",
    ),
    ("98", "Geblokkeerd", "Blok", False, False, False, 0, True, "#EEEEEE"),
    ("99", "Geprepositioneerd", "Prepos.", True, True, False, 3, True, "#38714B"),
]


def seed_statuses(apps, schema_editor):
    Status = apps.get_model("citygis", "VectorStatus")
    Status.objects.bulk_create(
        [
            Status(
                code=row[0],
                description=row[1],
                abbreviation=row[2],
                available=row[3],
                auxiliary_status=row[4],
                transport_status=row[5],
                gps_level=row[6],
                active=row[7],
                color=row[8],
            )
            for row in STATUS_ROWS
        ]
    )


def remove_statuses(apps, schema_editor):
    apps.get_model("citygis", "VectorStatus").objects.all().delete()


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="VectorStatus",
            fields=[
                ("code", models.CharField(max_length=3, primary_key=True, serialize=False)),
                ("description", models.CharField(max_length=120)),
                ("abbreviation", models.CharField(max_length=30)),
                ("available", models.BooleanField(default=False)),
                ("auxiliary_status", models.BooleanField(default=False)),
                ("transport_status", models.BooleanField(default=False)),
                ("gps_level", models.PositiveSmallIntegerField(default=0)),
                ("active", models.BooleanField(default=True)),
                ("color", models.CharField(max_length=7)),
            ],
            options={"ordering": ["code"]},
        ),
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("fireplan_id", models.PositiveBigIntegerField(unique=True)),
                ("alphacode", models.CharField(db_index=True, max_length=80)),
                ("plate", models.CharField(blank=True, max_length=40)),
                ("utilisation", models.CharField(blank=True, max_length=255)),
                ("chassis", models.CharField(blank=True, max_length=100)),
                ("fleet_status", models.CharField(blank=True, max_length=80)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["alphacode", "fireplan_id"]},
        ),
        migrations.CreateModel(
            name="Vector",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("vector_code", models.CharField(max_length=100, unique=True)),
                ("name", models.CharField(blank=True, max_length=100)),
                ("abbreviation", models.CharField(blank=True, max_length=100)),
                ("service_abbreviation", models.CharField(blank=True, max_length=80)),
                ("resource_type_code", models.CharField(blank=True, max_length=80)),
                ("resource_code", models.CharField(blank=True, max_length=100)),
                ("operational_status_code", models.CharField(blank=True, max_length=20)),
                ("status_description", models.CharField(blank=True, max_length=120)),
                ("status_updated_at", models.DateTimeField(blank=True, null=True)),
                ("source_vehicle_name", models.CharField(blank=True, max_length=100)),
                ("last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "vehicle",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="vector",
                        to="citygis.vehicle",
                    ),
                ),
            ],
            options={"ordering": ["service_abbreviation", "vector_code"]},
        ),
        migrations.RunPython(seed_statuses, remove_statuses),
    ]
