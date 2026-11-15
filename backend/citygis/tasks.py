import logging

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from fireplan.client import FireplanInventoryError, FireplanLoginError
from fireplan.crypto import decrypt_secret, encrypt_secret
from fireplan.models import FireplanCredential

from .client import CityGISError, fetch_fireplan_vehicles, fetch_resource_vectors
from .models import CityGISSyncState
from .synchronization import CityGISSyncPayloadError, synchronize_citygis_data

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="citygis.refresh",
    autoretry_for=(RuntimeError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.CELERY_TASK_MAX_RETRIES,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_TASK_TIME_LIMIT,
)
def refresh_citygis(self) -> dict[str, int | str]:
    sync_state, _ = CityGISSyncState.objects.get_or_create(pk=1)
    sync_state.last_attempted_at = timezone.now()
    sync_state.last_error = ""
    sync_state.save(update_fields=["last_attempted_at", "last_error", "updated_at"])
    try:
        credential = FireplanCredential.objects.filter(pk=1).first()
        if not credential or not credential.encrypted_password:
            raise RuntimeError("Stel eerst de Fireplan-inloggegevens in.")
        password = decrypt_secret(credential.encrypted_password)
        cookie_data = (
            decrypt_secret(credential.encrypted_cookies) if credential.encrypted_cookies else None
        )
        vehicles, refreshed_cookies = fetch_fireplan_vehicles(
            credential.login, password, cookie_data
        )
        vectors = fetch_resource_vectors(credential.login, password)

        # Commit CityGIS data and the refreshed encrypted session together. A
        # source or persistence failure leaves the prior snapshot untouched.
        with transaction.atomic():
            result = synchronize_citygis_data(vehicles, vectors)
            credential.encrypted_cookies = encrypt_secret(refreshed_cookies)
            completed_at = timezone.now()
            credential.session_checked_at = completed_at
            credential.save(update_fields=["encrypted_cookies", "session_checked_at", "updated_at"])
            sync_state.last_succeeded_at = completed_at
            sync_state.last_error = ""
            sync_state.save(update_fields=["last_succeeded_at", "last_error", "updated_at"])
        logger.info("CityGIS data refresh completed", extra={"task_id": self.request.id, **result})
        return {"message": "CityGIS-gegevens vernieuwd.", **result}
    except Exception as error:
        safe_errors = (
            CityGISError,
            CityGISSyncPayloadError,
            FireplanLoginError,
            FireplanInventoryError,
        )
        sync_state.last_error = (
            str(error)
            if isinstance(error, safe_errors)
            else "CityGIS-bronnen konden niet worden opgehaald of verwerkt."
        )
        sync_state.save(update_fields=["last_error", "updated_at"])
        logger.exception("CityGIS data refresh failed", extra={"task_id": self.request.id})
        raise
