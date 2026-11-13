import time

from celery import shared_task
from celery_progress.backend import ProgressRecorder
from django.conf import settings


@shared_task(
    bind=True,
    name="tasks.example_task",
    autoretry_for=(RuntimeError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.CELERY_TASK_MAX_RETRIES,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_TASK_TIME_LIMIT,
)
def example_task(self, duration_seconds: int = 30) -> dict[str, int | str]:
    """Idempotent demonstration work, reporting persisted progress once per second."""
    recorder = ProgressRecorder(self)
    total = max(1, int(duration_seconds))
    for current in range(1, total + 1):
        time.sleep(1)
        recorder.set_progress(current, total, description=f"Working: {current}/{total} seconds")
    return {"message": "Example task completed successfully.", "duration_seconds": total}
