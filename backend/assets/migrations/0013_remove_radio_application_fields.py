from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("assets", "0012_alter_radio_tei_alter_teirange_end_tei_and_more")]

    operations = [
        migrations.RemoveConstraint(
            model_name="radiomodel",
            name="uniq_radio_model_application",
        ),
        migrations.RemoveField(
            model_name="radiomodel",
            name="application",
        ),
        migrations.RemoveField(
            model_name="radio",
            name="application",
        ),
    ]
