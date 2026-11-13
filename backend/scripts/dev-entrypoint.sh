#!/bin/sh
set -eu
python manage.py migrate --noinput
python manage.py ensure_demo_user
exec uvicorn "${PYTHON_PACKAGE:-config}.asgi:application" --host 0.0.0.0 --port 8000 --reload --reload-dir /app
