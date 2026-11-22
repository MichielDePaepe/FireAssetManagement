from django.core.validators import RegexValidator
from django.db import migrations, models


def normalize_existing_teis(apps, schema_editor):
    database = schema_editor.connection.alias
    Radio = apps.get_model("assets", "Radio")
    TeiRange = apps.get_model("assets", "TeiRange")

    radios = Radio.objects.using(database)
    for radio in radios.only("pk", "tei").iterator():
        tei = radio.tei
        if len(tei) != 14 or not tei.isascii() or not tei.isdigit():
            continue
        normalized = f"{tei}0"
        if radios.filter(tei=normalized).exclude(pk=radio.pk).exists():
            raise RuntimeError(
                f"Radio TEI normalization conflicts for radio id {radio.pk}; "
                "resolve the duplicate before migrating."
            )
        radios.filter(pk=radio.pk).update(tei=normalized)

    ranges = TeiRange.objects.using(database)
    for tei_range in ranges.only("pk", "start_tei", "end_tei").iterator():
        start = tei_range.start_tei
        end = tei_range.end_tei
        normalized_start = (
            f"{start}0" if len(start) == 14 and start.isascii() and start.isdigit() else start
        )
        normalized_end = (
            f"{end}0" if len(end) == 14 and end.isascii() and end.isdigit() else end
        )
        if normalized_start != start or normalized_end != end:
            ranges.filter(pk=tei_range.pk).update(
                start_tei=normalized_start,
                end_tei=normalized_end,
            )


class Migration(migrations.Migration):
    dependencies = [("assets", "0015_alter_radio_tei_alter_teirange_end_tei_and_more")]

    operations = [
        migrations.RunPython(normalize_existing_teis, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="radio",
            name="tei",
            field=models.CharField(
                max_length=16,
                unique=True,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat 14, 15 of 16 cijfers.",
                        regex="^[0-9]{14,16}$",
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="teirange",
            name="start_tei",
            field=models.CharField(
                max_length=16,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat 14, 15 of 16 cijfers.",
                        regex="^[0-9]{14,16}$",
                    )
                ],
            ),
        ),
        migrations.AlterField(
            model_name="teirange",
            name="end_tei",
            field=models.CharField(
                max_length=16,
                validators=[
                    RegexValidator(
                        message="Een TEI bevat 14, 15 of 16 cijfers.",
                        regex="^[0-9]{14,16}$",
                    )
                ],
            ),
        ),
    ]
