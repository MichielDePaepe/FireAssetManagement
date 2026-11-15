from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("citygis", "0002_catalog_and_source_presence")]

    operations = [
        migrations.CreateModel(
            name="CityGISSyncState",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("last_attempted_at", models.DateTimeField(blank=True, null=True)),
                ("last_succeeded_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "CityGIS synchronization state",
                "verbose_name_plural": "CityGIS synchronization state",
            },
        ),
    ]
