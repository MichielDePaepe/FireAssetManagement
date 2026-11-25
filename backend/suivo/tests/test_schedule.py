from celery.schedules import crontab
from django.conf import settings


def test_daily_suivo_reconciliation_runs_once_at_brussels_three_am():
    schedule = settings.CELERY_BEAT_SCHEDULE["suivo-sync-daily"]
    assert schedule["task"] == "suivo.sync"
    assert schedule["schedule"] == crontab(hour=3, minute=0)
    assert schedule["options"]["ignore_result"] is True
    assert settings.CELERY_TIMEZONE == "Europe/Brussels"
