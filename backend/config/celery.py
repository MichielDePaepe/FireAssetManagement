import os

from celery import Celery

package = os.getenv("PYTHON_PACKAGE", "config")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"{package}.settings")
app = Celery(package)
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
