import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assets", "0003_pager_fireplan_id_pager_fireplan_qr_url")]

    operations = [
        migrations.CreateModel(
            name="PagerCode",
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
                ("ric_code", models.CharField(max_length=20)),
                ("adc_code", models.CharField(max_length=20)),
                ("alias", models.CharField(max_length=100)),
                (
                    "protocol",
                    models.CharField(
                        choices=[("HTTP2page", "HTTP2page"), ("SDS2page", "SDS2page")],
                        max_length=20,
                    ),
                ),
                (
                    "pager",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="codes",
                        to="assets.pager",
                    ),
                ),
            ],
            options={"db_table": "pager_codes", "ordering": ["alias", "ric_code"]},
        ),
    ]
