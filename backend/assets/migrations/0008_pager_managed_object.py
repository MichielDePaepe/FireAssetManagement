import django.db.models.deletion
from django.db import migrations, models


def attach_managed_objects(apps, schema_editor):
    Pager = apps.get_model("assets", "Pager")
    ManagedObject = apps.get_model("inventory", "ManagedObject")
    alias = schema_editor.connection.alias
    pagers = list(Pager.objects.using(alias).order_by("pk").values_list("pk", flat=True))
    objects = [ManagedObject(kind="pager") for _ in pagers]
    ManagedObject.objects.using(alias).bulk_create(objects)
    for pager_id, managed_object in zip(pagers, objects, strict=True):
        Pager.objects.using(alias).filter(pk=pager_id).update(managed_object_id=managed_object.pk)


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0007_seed_ric_codes"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pager",
            name="managed_object",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pager",
                to="inventory.managedobject",
            ),
        ),
        migrations.RunPython(attach_managed_objects, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pager",
            name="managed_object",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pager",
                to="inventory.managedobject",
            ),
        ),
    ]
