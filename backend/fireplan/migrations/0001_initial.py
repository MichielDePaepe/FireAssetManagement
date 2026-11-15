from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="FireplanCredential",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("login", models.CharField(max_length=255)),
                ("encrypted_password", models.TextField()),
                ("encrypted_cookies", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("session_checked_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
    ]
