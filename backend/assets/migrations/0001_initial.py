import django.db.models.deletion
from django.db import migrations, models


def create_initial_pager_types(apps, schema_editor):
    PagerType = apps.get_model("assets", "PagerType")
    PagerType.objects.using(schema_editor.connection.alias).bulk_create(
        [
            PagerType(name="Swissphone s.QUAD X35"),
            PagerType(name="Swissphone RES.Q XS"),
        ]
    )


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="PagerType",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={
                "ordering": ["name"],
                "verbose_name": "pager type",
                "verbose_name_plural": "pager types",
            },
        ),
        migrations.CreateModel(
            name="Pager",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("serial_number", models.CharField(max_length=100, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="pagers",
                        to="assets.pagertype",
                    ),
                ),
            ],
            options={"ordering": ["serial_number"]},
        ),
        migrations.RunPython(create_initial_pager_types, migrations.RunPython.noop),
    ]
