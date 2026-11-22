from collections.abc import Callable

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import IntegrityError, transaction

from assets.models import Radio, RadioModel, normalize_tei, tei_validator
from inventory.models import ManagedObject

RADIO_NAMES = {"Radio mobile Astrid", "Radio portable Astrid"}


def _error_summary(record: object, message: str) -> dict[str, object]:
    return {
        "fireplan_id": record.get("id") if isinstance(record, dict) else None,
        "name": record.get("name") if isinstance(record, dict) else None,
        "message": message,
    }


def _validated_source_fields(record: dict):
    name = record.get("name")
    if not isinstance(name, str) or name not in RADIO_NAMES:
        return None

    fireplan_id = record.get("id")
    if isinstance(fireplan_id, bool) or not isinstance(fireplan_id, int) or fireplan_id <= 0:
        raise ValidationError("FirePlan-ID ontbreekt of is ongeldig.")

    tei = record.get("serialNumber")
    if not isinstance(tei, str) or not tei or tei.strip() != tei:
        raise ValidationError("TEI ontbreekt of is geen geldige tekstwaarde.")
    tei = normalize_tei(tei)
    try:
        tei_validator(tei)
    except ValidationError as error:
        raise ValidationError("TEI moet na normalisatie precies 15 cijfers bevatten.") from error

    qr_url = record.get("qrCode")
    if not isinstance(qr_url, str) or not qr_url or qr_url.strip() != qr_url:
        raise ValidationError("QR-URL ontbreekt of is ongeldig.")
    try:
        URLValidator()(qr_url)
    except ValidationError as error:
        raise ValidationError("QR-URL is ongeldig.") from error
    if len(qr_url) > 500:
        raise ValidationError("QR-URL is langer dan 500 tekens.")
    return fireplan_id, tei, qr_url


def synchronize_fireplan_radios(
    records: list[dict],
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> dict[str, object]:
    """Import confirmed FirePlan radio QR records without deleting local-only radios."""
    summary: dict[str, object] = {
        "added": 0,
        "updated": 0,
        "unchanged": 0,
        "skipped": 0,
        "errors": [],
    }
    errors: list[dict[str, object]] = summary["errors"]  # type: ignore[assignment]
    total = len(records)

    for current, record in enumerate(records, start=1):
        try:
            if not isinstance(record, dict):
                errors.append(_error_summary(record, "FirePlan-record is ongeldig."))
                continue
            try:
                fields = _validated_source_fields(record)
            except ValidationError as error:
                errors.append(_error_summary(record, str(error.messages[0])))
                continue
            if fields is None:
                summary["skipped"] = int(summary["skipped"]) + 1
                continue

            fireplan_id, tei, qr_url = fields
            try:
                with transaction.atomic():
                    radio = (
                        Radio.objects.select_for_update()
                        .filter(fireplan_id=fireplan_id)
                        .first()
                    )
                    if radio is None:
                        radio = Radio.objects.select_for_update().filter(tei=tei).first()
                    if radio and radio.fireplan_id not in (None, fireplan_id):
                        errors.append(
                            _error_summary(record, "TEI is al gekoppeld aan een ander FirePlan-ID.")
                        )
                        continue

                    model = RadioModel.for_tei(tei)
                    values = {
                        "tei": tei,
                        "model": model,
                        "fireplan_id": fireplan_id,
                        "fireplan_qr_url": qr_url,
                    }
                    if radio is None:
                        managed_object = ManagedObject.objects.create(kind=ManagedObject.Kind.RADIO)
                        radio = Radio(managed_object=managed_object, **values)
                        radio.full_clean()
                        radio.save()
                        summary["added"] = int(summary["added"]) + 1
                        continue

                    if all(getattr(radio, field) == value for field, value in values.items()):
                        summary["unchanged"] = int(summary["unchanged"]) + 1
                        continue
                    for field, value in values.items():
                        setattr(radio, field, value)
                    radio.full_clean()
                    radio.save(update_fields=[*values, "updated_at"])
                    summary["updated"] = int(summary["updated"]) + 1
            except (IntegrityError, ValidationError) as error:
                message = (
                    str(error.messages[0])
                    if isinstance(error, ValidationError)
                    else "TEI of FirePlan-ID botst met een bestaande radio."
                )
                errors.append(_error_summary(record, message))
        finally:
            if progress_callback:
                name = record.get("name", "") if isinstance(record, dict) else ""
                progress_callback(current, max(1, total), f"Radio verwerken: {name}")

    return summary
