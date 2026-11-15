from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("assets", "0005_make_pager_codes_standalone")]

    operations = [
        migrations.RenameModel(old_name="PagerCode", new_name="RicCode"),
        migrations.AlterModelTable(name="riccode", table="ric_codes"),
        migrations.AlterModelOptions(
            name="riccode",
            options={"ordering": ["alias", "ric_code"]},
        ),
    ]
