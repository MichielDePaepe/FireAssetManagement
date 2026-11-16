from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("citygis", "0007_vectorstatushistory"),
    ]

    operations = [
        migrations.AddField(
            model_name="location",
            name="sort_name",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
    ]
