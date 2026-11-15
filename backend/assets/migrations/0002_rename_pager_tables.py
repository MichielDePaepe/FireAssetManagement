from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelTable(
            name="pagertype",
            table="pager_types",
        ),
        migrations.AlterModelTable(
            name="pager",
            table="pager_assets",
        ),
    ]
