from django.db import migrations, models

RIC_CODES = [
    ("2006319", "652901", "Dispatching 1"),
    ("2006320", "652902", "Dispatching 2"),
    ("2006321", "652903", "Dispatching 3"),
    ("760845", "652907", "Dispatching 4"),
    ("760844", "652908", "Dispatching 5"),
    ("2006322", "652904", "Dispatching ALL"),
    ("2006323", "652905", "HC112 ALL"),
    ("2006324", "652906", "HC112-Supervisor"),
    ("754110", "652101", "HC112-A"),
    ("754111", "652102", "HC112-B"),
    ("754112", "652103", "HC112-C"),
    ("760835", "652741", "A ANDERLECHT 1"),
    ("760822", "652742", "A ANDERLECHT 2"),
    ("760799", "652743", "A ANDERLECHT 3"),
    ("760800", "652744", "A ANDERLECHT 4"),
    ("760801", "652751", "A VUB 1"),
    ("760802", "652752", "A VUB 2"),
    ("760803", "652753", "A VUB 3"),
    ("760805", "652735", "A UCL 1"),
    ("760807", "652731", "A DELTA 1"),
    ("760808", "652732", "A DELTA 2"),
    ("760809", "652733", "A DELTA 3"),
    ("760810", "652745", "A CHN 1"),
    ("760811", "652716", "A CITE 1"),
    ("760812", "652717", "A CITE 2"),
    ("760806", "652736", "A CITE 3"),
    ("760831", "652719", "A HSM 1"),
    ("760813", "652718", "A HSM 2"),
    ("760796", "652747", "A HSP 1"),
    ("760797", "652748", "A HSP 2"),
    ("760798", "652749", "A HSP 3"),
    ("760832", "652720", "A BRIEN 1"),
    ("760833", "652721", "A BRIEN 2"),
    ("760834", "652722", "A BRIEN 3"),
    ("760711", "652711", "A EM 1"),
    ("760712", "652712", "A EM 2"),
    ("760713", "652713", "A EM 3"),
    ("760714", "652714", "A EM 4"),
    ("760710", "652710", "A INC"),
    ("760804", "652850", "PIT VUB"),
    ("760794", "652840", "PIT HSP"),
    ("760843", "652746", "PIT HSM"),
    ("760795", "652841", "MUG HSP"),
    ("760793", "652830", "MUG HSE"),
    ("760792", "652739", "A HSE"),
    ("760816", "652781", "A FOR 1"),
    ("760815", "652891", "PIT CR"),
    ("760817", "652791", "A CATA 1"),
    ("760818", "652792", "A CATA 2"),
    ("760819", "652793", "A CATA 3"),
    ("760820", "652794", "A CATA 4"),
    ("760893", "652900", "A CATA 5"),
    ("760894", "652104", "vrije code"),
    ("760892", "652106", "vrije code"),
    ("760814", "652798", "vrije code"),
    ("760891", "652105", "test test"),
]


def remove_duplicate_pairs(apps, schema_editor):
    RicCode = apps.get_model("assets", "RicCode")
    database = schema_editor.connection.alias
    groups = {}
    rows = (
        RicCode.objects.using(database)
        .order_by("pk")
        .values_list("pk", "ric_code", "adc_code", "alias")
    )
    for pk, ric_code, adc_code, alias in rows.iterator():
        groups.setdefault((ric_code, adc_code), []).append((pk, alias))

    for pair, entries in groups.items():
        preferred_alias = "PIT HSP" if pair == ("760794", "652840") else None
        keeper = next(
            (entry for entry in entries if preferred_alias and entry[1] == preferred_alias),
            entries[0],
        )
        if preferred_alias and keeper[1] != preferred_alias:
            RicCode.objects.using(database).filter(pk=keeper[0]).update(alias=preferred_alias)
        duplicate_ids = [pk for pk, _alias in entries if pk != keeper[0]]
        if duplicate_ids:
            RicCode.objects.using(database).filter(pk__in=duplicate_ids).delete()


def seed_ric_codes(apps, schema_editor):
    RicCode = apps.get_model("assets", "RicCode")
    database = schema_editor.connection.alias
    existing_pairs = set(RicCode.objects.using(database).values_list("ric_code", "adc_code"))
    new_rows = []
    for ric_code, adc_code, alias in RIC_CODES:
        pair = (ric_code, adc_code)
        if pair in existing_pairs:
            continue
        existing_pairs.add(pair)
        new_rows.append(RicCode(ric_code=ric_code, adc_code=adc_code, alias=alias))
    RicCode.objects.using(database).bulk_create(new_rows)


class Migration(migrations.Migration):
    dependencies = [("assets", "0006_rename_pagercode_riccode")]

    operations = [
        migrations.RunPython(remove_duplicate_pairs, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="riccode",
            constraint=models.UniqueConstraint(
                fields=("ric_code", "adc_code"), name="uniq_ric_adc_pair"
            ),
        ),
        migrations.RunPython(seed_ric_codes, migrations.RunPython.noop),
    ]
