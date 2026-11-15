from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("assets", "0004_pager_codes")]

    operations = [
        migrations.RemoveField(model_name="pagercode", name="pager"),
        migrations.RemoveField(model_name="pagercode", name="protocol"),
    ]
