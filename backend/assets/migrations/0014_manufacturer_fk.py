import django.db.models.deletion
from django.db import migrations, models


def move_manufacturer_names_to_table(apps, schema_editor):
    Manufacturer = apps.get_model("assets", "Manufacturer")
    RadioModel = apps.get_model("assets", "RadioModel")
    database = schema_editor.connection.alias

    for radio_model in RadioModel.objects.using(database).all().iterator():
        manufacturer, _ = Manufacturer.objects.using(database).get_or_create(
            name=radio_model.manufacturer
        )
        RadioModel.objects.using(database).filter(pk=radio_model.pk).update(
            manufacturer_fk_id=manufacturer.pk
        )


class Migration(migrations.Migration):
    dependencies = [("assets", "0013_remove_radio_application_fields")]

    operations = [
        migrations.CreateModel(
            name="Manufacturer",
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
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddField(
            model_name="radiomodel",
            name="manufacturer_fk",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="radio_models",
                to="assets.manufacturer",
            ),
        ),
        migrations.RunPython(move_manufacturer_names_to_table, migrations.RunPython.noop),
        migrations.RemoveField(model_name="radiomodel", name="manufacturer"),
        migrations.RenameField(
            model_name="radiomodel", old_name="manufacturer_fk", new_name="manufacturer"
        ),
        migrations.AlterField(
            model_name="radiomodel",
            name="manufacturer",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="radio_models",
                to="assets.manufacturer",
            ),
        ),
        migrations.AlterModelOptions(
            name="radiomodel", options={"ordering": ["manufacturer__name", "name"]}
        ),
    ]
