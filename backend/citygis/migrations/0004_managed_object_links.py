import django.db.models.deletion
from django.db import migrations, models


def attach_managed_objects(apps, schema_editor):
    Vehicle = apps.get_model("citygis", "Vehicle")
    Vector = apps.get_model("citygis", "Vector")
    ManagedObject = apps.get_model("inventory", "ManagedObject")
    alias = schema_editor.connection.alias
    vehicles = list(Vehicle.objects.using(alias).order_by("pk").values_list("pk", flat=True))
    vectors = list(Vector.objects.using(alias).order_by("pk").values_list("pk", flat=True))
    objects = [ManagedObject(kind="vehicle") for _ in vehicles] + [
        ManagedObject(kind="vector") for _ in vectors
    ]
    ManagedObject.objects.using(alias).bulk_create(objects)
    for record_id, managed_object in zip(vehicles, objects[: len(vehicles)], strict=True):
        Vehicle.objects.using(alias).filter(pk=record_id).update(
            managed_object_id=managed_object.pk
        )
    for record_id, managed_object in zip(vectors, objects[len(vehicles) :], strict=True):
        Vector.objects.using(alias).filter(pk=record_id).update(managed_object_id=managed_object.pk)


class Migration(migrations.Migration):
    dependencies = [
        ("citygis", "0003_sync_state"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="managed_object",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vehicle",
                to="inventory.managedobject",
            ),
        ),
        migrations.AddField(
            model_name="vector",
            name="managed_object",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vector",
                to="inventory.managedobject",
            ),
        ),
        migrations.RunPython(attach_managed_objects, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="vehicle",
            name="managed_object",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vehicle",
                to="inventory.managedobject",
            ),
        ),
        migrations.AlterField(
            model_name="vector",
            name="managed_object",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vector",
                to="inventory.managedobject",
            ),
        ),
    ]
