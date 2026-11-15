from django.db import migrations, models


def correct_screenshot_descriptions(apps, schema_editor):
    Status = apps.get_model("citygis", "VectorStatus")
    Status.objects.filter(code="91").update(description="Buitendienststelling - tech reden")
    Status.objects.filter(code="92").update(description="Buitendienststelling - materiaal tekort")


class Migration(migrations.Migration):
    dependencies = [("citygis", "0001_initial")]

    operations = [
        migrations.RemoveField(model_name="vectorstatus", name="available"),
        migrations.RemoveField(model_name="vectorstatus", name="auxiliary_status"),
        migrations.RemoveField(model_name="vectorstatus", name="transport_status"),
        migrations.RemoveField(model_name="vectorstatus", name="gps_level"),
        migrations.RemoveField(model_name="vectorstatus", name="active"),
        migrations.RemoveField(model_name="vector", name="status_description"),
        migrations.AddField(
            model_name="vehicle",
            name="is_current",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="last_seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="vector",
            name="is_current",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(correct_screenshot_descriptions, migrations.RunPython.noop),
    ]
