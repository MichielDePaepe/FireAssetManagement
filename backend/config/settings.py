import os
from pathlib import Path
from urllib.parse import urlparse

from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-development-key-change-before-production")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,api")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

parsed_db = urlparse(
    os.getenv("DATABASE_URL", "postgres://web_project_starter:dev@db:5432/web_project_starter")
)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed_db.path.lstrip("/"),
        "USER": parsed_db.username or "",
        "PASSWORD": parsed_db.password or "",
        "HOST": parsed_db.hostname or "db",
        "PORT": parsed_db.port or 5432,
        "CONN_MAX_AGE": 60,
    }
}

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "celery_progress",
    "django_celery_results",
    "drf_spectacular",
    "tasks",
    "assets",
    "inventory",
    "fireplan",
    "printers",
    "citygis",
    "suivo",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Brussels"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}
SPECTACULAR_SETTINGS = {
    "TITLE": os.getenv("APP_TITLE", "Fire Asset Management") + " API",
    "DESCRIPTION": "Task and pager asset API.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
FIREPLAN_BASE_URL = os.getenv("FIREPLAN_BASE_URL", "https://fireplan.firebru2k8.local").rstrip("/")
CITYGIS_RESOURCES_BASE_URL = os.getenv(
    "CITYGIS_RESOURCES_BASE_URL", "http://resourcesoff.firebru2k8.local"
).rstrip("/")
SUIVO_BASE_URL = os.getenv("SUIVO_BASE_URL", "https://integrate.suivo.com").rstrip("/")
SUIVO_WSS_URL = os.getenv("SUIVO_WSS_URL", "wss://integrate.suivo.com/socket")
SUIVO_CLIENT_ID = os.getenv("SUIVO_CLIENT_ID", "")
SUIVO_CLIENT_SECRET = os.getenv("SUIVO_CLIENT_SECRET", "")
FIREPLAN_CREDENTIAL_KEY = os.getenv("FIREPLAN_CREDENTIAL_KEY", "")
FIREPLAN_ALLOW_CERTIFICATE_HOSTNAME_MISMATCH = env_bool(
    "FIREPLAN_ALLOW_CERTIFICATE_HOSTNAME_MISMATCH"
)
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "default"
CELERY_TASK_TRACK_STARTED = True
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "75"))
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "90"))
CELERY_FIREPLAN_INVENTORY_TASK_SOFT_TIME_LIMIT = int(
    os.getenv("CELERY_FIREPLAN_INVENTORY_TASK_SOFT_TIME_LIMIT", "1800")
)
CELERY_FIREPLAN_INVENTORY_TASK_TIME_LIMIT = int(
    os.getenv("CELERY_FIREPLAN_INVENTORY_TASK_TIME_LIMIT", "1860")
)
CELERY_TASK_DEFAULT_RETRY_DELAY = int(os.getenv("CELERY_TASK_DEFAULT_RETRY_DELAY", "5"))
CELERY_TASK_MAX_RETRIES = int(os.getenv("CELERY_TASK_MAX_RETRIES", "3"))
CELERY_RESULT_EXTENDED = True
CELERY_RESULT_EXPIRES = int(os.getenv("CELERY_RESULT_EXPIRES", "604800"))
CELERY_TIMEZONE = "Europe/Brussels"
CELERY_BROKER_TRANSPORT_OPTIONS = {"visibility_timeout": 3600}
CELERY_BEAT_SCHEDULE = {
    "citygis-refresh-every-minute": {
        "task": "citygis.refresh",
        "schedule": 60.0,
    },
    "fireplan-inventory-sync-hourly": {
        "task": "fireplan.sync_inventories",
        "schedule": 3600.0,
        "options": {"ignore_result": True},
    },
    "suivo-sync-daily": {
        "task": "suivo.sync",
        "schedule": crontab(hour=3, minute=0),
        "options": {"ignore_result": True},
    },
}

SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_COOKIES = env_bool("DJANGO_SECURE_COOKIES", False)
SESSION_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_SECURE = SECURE_COOKIES
if SECURE_COOKIES:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "config.logging.JsonFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}
