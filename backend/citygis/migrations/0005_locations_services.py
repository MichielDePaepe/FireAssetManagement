import django.db.models.deletion
from django.db import migrations, models


def normalize_existing_services(apps, schema_editor):
    Service = apps.get_model("citygis", "Service")
    Vector = apps.get_model("citygis", "Vector")
    alias = schema_editor.connection.alias
    abbreviations = sorted(
        {
            abbreviation
            for abbreviation in Vector.objects.using(alias)
            .values_list("service_abbreviation", flat=True)
            .distinct()
            if abbreviation
        }
    )
    Service.objects.using(alias).bulk_create(
        [Service(abbreviation=abbreviation) for abbreviation in abbreviations]
    )
    service_ids = dict(
        Service.objects.using(alias)
        .filter(abbreviation__in=abbreviations)
        .values_list("abbreviation", "pk")
    )
    for abbreviation, service_id in service_ids.items():
        Vector.objects.using(alias).filter(service_abbreviation=abbreviation).update(
            service_id=service_id
        )


class Migration(migrations.Migration):
    dependencies = [("citygis", "0004_managed_object_links")]

    operations = [
        migrations.CreateModel(
            name="Service",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("abbreviation", models.CharField(max_length=80, unique=True)),
            ],
            options={"ordering": ["abbreviation"]},
        ),
        migrations.CreateModel(
            name="Location",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=160)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("post", "Post"),
                            ("building", "Building"),
                            ("room", "Room"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children",
                        to="citygis.location",
                    ),
                ),
                (
                    "service",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="location",
                        to="citygis.service",
                    ),
                ),
            ],
            options={"ordering": ["name", "id"]},
        ),
        migrations.AddField(
            model_name="vector",
            name="service",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="vectors",
                to="citygis.service",
            ),
        ),
        migrations.RunPython(normalize_existing_services, migrations.RunPython.noop),
    ]
