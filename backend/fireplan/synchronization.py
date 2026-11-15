from collections.abc import Callable

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import IntegrityError, transaction

from assets.models import Pager, PagerType


def _error_summary(record: object, message: str) -> dict[str, object]:
    if isinstance(record, dict):
        fireplan_id = record.get("id")
        serial_number = record.get("serialNumber")
        name = record.get("name")
    else:
        fireplan_id = serial_number = name = None
    return {
        "fireplan_id": fireplan_id if isinstance(fireplan_id, int) else None,
        "serial_number": serial_number if isinstance(serial_number, str) else None,
        "name": name if isinstance(name, str) else None,
        "message": message,
    }


def _validate_record(record: dict, pager_types: dict[str, PagerType]):
    model_name = record.get("name")
    pager_type = pager_types.get(model_name) if isinstance(model_name, str) else None
    if pager_type is None:
        return None

    fireplan_id = record.get("id")
    if isinstance(fireplan_id, bool) or not isinstance(fireplan_id, int) or fireplan_id <= 0:
        raise ValidationError("Fireplan-ID ontbreekt of is ongeldig.")

    serial_number = record.get("serialNumber")
    if not isinstance(serial_number, str) or not serial_number.strip():
        raise ValidationError("Serienummer ontbreekt.")
    serial_number = serial_number.strip()
    if len(serial_number) > 100:
        raise ValidationError("Serienummer is langer dan 100 tekens.")

    qr_url = record.get("qrCode")
    if not isinstance(qr_url, str) or not qr_url.strip():
        raise ValidationError("QR-URL ontbreekt.")
    qr_url = qr_url.strip()
    try:
        URLValidator()(qr_url)
    except ValidationError as error:
        raise ValidationError("QR-URL is ongeldig.") from error
    if len(qr_url) > 500:
        raise ValidationError("QR-URL is langer dan 500 tekens.")

    return fireplan_id, pager_type, serial_number, qr_url


def synchronize_fireplan_pagers(
    records: list[dict],
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> dict[str, object]:
    """Create or update local pagers from Fireplan records without deleting local-only rows."""
    pager_types = {pager_type.name: pager_type for pager_type in PagerType.objects.all()}
    summary: dict[str, object] = {"added": 0, "updated": 0, "unchanged": 0, "errors": []}
    errors: list[dict[str, object]] = summary["errors"]  # type: ignore[assignment]
    total = len(records)

    for current, record in enumerate(records, start=1):
        try:
            if not isinstance(record, dict):
                errors.append(_error_summary(record, "Fireplan-record is ongeldig."))
                continue

            try:
                validated = _validate_record(record, pager_types)
            except ValidationError as error:
                errors.append(_error_summary(record, str(error.messages[0])))
                continue

            if validated is None:
                continue
            fireplan_id, pager_type, serial_number, qr_url = validated

            try:
                with transaction.atomic():
                    pager = (
                        Pager.objects.select_for_update()
                        .filter(fireplan_id=fireplan_id)
                        .first()
                    )
                    if pager is None:
                        pager = (
                            Pager.objects.select_for_update()
                            .filter(serial_number=serial_number)
                            .first()
                        )
                    if pager and pager.fireplan_id not in (None, fireplan_id):
                        errors.append(
                            _error_summary(
                                record,
                                "Serienummer is al gekoppeld aan een ander Fireplan-ID.",
                            )
                        )
                        continue

                    if pager is None:
                        Pager.objects.create(
                            serial_number=serial_number,
                            type=pager_type,
                            fireplan_id=fireplan_id,
                            fireplan_qr_url=qr_url,
                        )
                        summary["added"] = int(summary["added"]) + 1
                    elif (
                        pager.serial_number == serial_number
                        and pager.type_id == pager_type.id
                        and pager.fireplan_id == fireplan_id
                        and pager.fireplan_qr_url == qr_url
                    ):
                        summary["unchanged"] = int(summary["unchanged"]) + 1
                    else:
                        pager.serial_number = serial_number
                        pager.type = pager_type
                        pager.fireplan_id = fireplan_id
                        pager.fireplan_qr_url = qr_url
                        pager.save(
                            update_fields=[
                                "serial_number",
                                "type",
                                "fireplan_id",
                                "fireplan_qr_url",
                                "updated_at",
                            ]
                        )
                        summary["updated"] = int(summary["updated"]) + 1
            except IntegrityError:
                errors.append(
                    _error_summary(
                        record,
                        "Serienummer of Fireplan-ID komt al voor bij een andere pager.",
                    )
                )
        finally:
            if progress_callback:
                name = record.get("name") if isinstance(record, dict) else ""
                progress_callback(current, max(1, total), f"Pager verwerken: {name}")

    return summary
