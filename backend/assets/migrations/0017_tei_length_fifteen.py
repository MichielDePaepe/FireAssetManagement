from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assets", "0016_normalize_tei_digits")]

    operations = [
        migrations.AlterField(
            model_name="radio",
            name="tei",
            field=models.CharField(
                max_length=15,
                unique=True,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat precies 15 cijfers.", regex="^[0-9]{15}$"
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="teirange",
            name="start_tei",
            field=models.CharField(
                max_length=15,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat precies 15 cijfers.", regex="^[0-9]{15}$"
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="teirange",
            name="end_tei",
            field=models.CharField(
                max_length=15,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat precies 15 cijfers.", regex="^[0-9]{15}$"
                    )
                ],
            ),
        ),
    ]
