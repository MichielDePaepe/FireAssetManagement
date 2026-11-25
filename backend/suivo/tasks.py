import logging

from celery import shared_task
from celery_progress.backend import ProgressRecorder
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .client import SuivoClient, SuivoError
from .models import SuivoSyncState
from .synchronization import synchronize_suivo_snapshot

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="suivo.sync",
    autoretry_for=(SuivoError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.CELERY_TASK_MAX_RETRIES,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_TASK_TIME_LIMIT,
)
def synchronize_suivo(self) -> dict[str, object]:
    state, _ = SuivoSyncState.objects.get_or_create(pk=1)
    state.last_attempted_at = timezone.now()
    state.last_error = ""
    state.save(update_fields=["last_attempted_at", "last_error", "updated_at"])
    progress = ProgressRecorder(self)
    try:
        client = SuivoClient()
        progress.set_progress(0, 3, description="Suivo-assets ophalen")
        units = client.fetch_units()
        progress.set_progress(1, 3, description="Suivo-trackers ophalen")
        devices = client.fetch_devices()
        progress.set_progress(2, 3, description="Suivo-status ophalen")
        statuses = client.fetch_unit_statuses()
        with transaction.atomic():
            result = synchronize_suivo_snapshot(units, devices, statuses)
            state.last_succeeded_at = timezone.now()
            state.last_error = ""
            state.save(update_fields=["last_succeeded_at", "last_error", "updated_at"])
        progress.set_progress(3, 3, description="Suivo-kopie bijgewerkt")
        logger.info("Suivo synchronization completed", extra={"task_id": self.request.id, **result})
        return {"message": "Suivo-gegevens vernieuwd.", **result}
    except Exception as error:
        state.last_error = (
            str(error)
            if isinstance(error, SuivoError)
            else "Suivo-gegevens konden niet worden verwerkt."
        )
        state.save(update_fields=["last_error", "updated_at"])
        logger.exception("Suivo synchronization failed", extra={"task_id": self.request.id})
        raise
