import logging

from celery import shared_task
from celery_progress.backend import ProgressRecorder
from django.conf import settings
from django.utils import timezone

from assets.models import PagerType

from .client import FireplanLoginError, fetch_inventory_qr_codes
from .crypto import decrypt_secret, encrypt_secret
from .models import FireplanCredential
from .synchronization import synchronize_fireplan_pagers

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="fireplan.sync_pagers",
    autoretry_for=(RuntimeError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.CELERY_TASK_MAX_RETRIES,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_TASK_TIME_LIMIT,
)
def synchronize_pagers(self) -> dict[str, object]:
    """Fetch Fireplan inventory, then idempotently update local pager records."""
    progress = ProgressRecorder(self)
    progress.set_progress(0, 1, description="Fireplan-inventaris ophalen")

    credential = FireplanCredential.objects.filter(pk=1).first()
    if not credential or not credential.encrypted_password:
        raise FireplanLoginError("Stel eerst Fireplan-inloggegevens in.")

    password = decrypt_secret(credential.encrypted_password)
    cookie_data = (
        decrypt_secret(credential.encrypted_cookies) if credential.encrypted_cookies else None
    )
    model_names = list(PagerType.objects.values_list("name", flat=True))

    # Fetch every page before writing pager rows so a partial Fireplan response
    # cannot leave the local inventory half-synchronized.
    records, refreshed_cookie_data = fetch_inventory_qr_codes(
        credential.login,
        password,
        cookie_data,
        model_names,
    )
    credential.encrypted_cookies = encrypt_secret(refreshed_cookie_data)
    credential.session_checked_at = timezone.now()
    credential.save(update_fields=["encrypted_cookies", "session_checked_at", "updated_at"])

    if not records:
        progress.set_progress(1, 1, description="Geen Fireplan-pagers gevonden")
    summary = synchronize_fireplan_pagers(
        records,
        progress_callback=lambda current, total, description: progress.set_progress(
            current, total, description=description
        ),
    )
    result = {"message": "Fireplan-pagersynchronisatie voltooid.", **summary}
    logger.info(
        "Fireplan pager synchronization finished",
        extra={
            "task_id": self.request.id,
            "added": summary["added"],
            "updated": summary["updated"],
            "unchanged": summary["unchanged"],
            "error_count": len(summary["errors"]),
        },
    )
    return result
