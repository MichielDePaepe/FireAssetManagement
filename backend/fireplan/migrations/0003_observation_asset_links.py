import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


def backfill_radio_observations(apps, schema_editor):
    Observation = apps.get_model("fireplan", "FireplanRadioObservation")
    Radio = apps.get_model("assets", "Radio")
    database = schema_editor.connection.alias
    radio_by_tei = dict(Radio.objects.using(database).values_list("tei", "pk"))
    observations = Observation.objects.using(database).all().only("id", "serial_number")
    for observation in observations.iterator(chunk_size=1000):
        value = observation.serial_number
        if not value.isascii() or not value.isdigit():
            continue
        if len(value) == 14:
            value = f"{value}0"
        elif len(value) != 15:
            continue
        radio_id = radio_by_tei.get(value)
        if radio_id:
            Observation.objects.using(database).filter(pk=observation.pk).update(radio_id=radio_id)


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0017_tei_length_fifteen"),
        ("fireplan", "0002_fireplaninventory_fireplanradioobservation"),
    ]

    operations = [
        migrations.AddField(
            model_name="fireplanradioobservation",
            name="radio",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="fireplan_observations",
                to="assets.radio",
            ),
        ),
        migrations.AddField(
            model_name="fireplanradioobservation",
            name="pager",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="fireplan_observations",
                to="assets.pager",
            ),
        ),
        migrations.RunPython(backfill_radio_observations, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="fireplanradioobservation",
            constraint=models.CheckConstraint(
                condition=Q(radio__isnull=True) | Q(pager__isnull=True),
                name="fireplan_observation_single_asset",
            ),
        ),
    ]
