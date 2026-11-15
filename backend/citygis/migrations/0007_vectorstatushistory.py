import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


def backfill_current_status(apps, schema_editor):
    Vector = apps.get_model("citygis", "Vector")
    StatusHistory = apps.get_model("citygis", "VectorStatusHistory")
    alias = schema_editor.connection.alias
    vectors = Vector.objects.using(alias).all().values(
        "id", "operational_status_code", "status_updated_at", "last_seen_at", "updated_at"
    )
    StatusHistory.objects.using(alias).bulk_create(
        [
            StatusHistory(
                vector_id=row["id"],
                status_code=row["operational_status_code"],
                source_effective_at=row["status_updated_at"],
                observed_at=row["last_seen_at"] or row["updated_at"],
            )
            for row in vectors
        ]
    )


class Migration(migrations.Migration):
    dependencies = [("citygis", "0006_vectorservicehistory_vectorvehiclehistory")]

    operations = [
        migrations.CreateModel(
            name="VectorStatusHistory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("status_code", models.CharField(blank=True, max_length=20)),
                ("source_effective_at", models.DateTimeField(blank=True, null=True)),
                ("observed_at", models.DateTimeField()),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                (
                    "vector",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="status_history",
                        to="citygis.vector",
                    ),
                ),
            ],
            options={"ordering": ["-source_effective_at", "-observed_at", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="vectorstatushistory",
            constraint=models.UniqueConstraint(
                condition=Q(ended_at__isnull=True),
                fields=("vector",),
                name="uniq_active_vector_status_history",
            ),
        ),
        migrations.RunPython(backfill_current_status, migrations.RunPython.noop),
    ]
