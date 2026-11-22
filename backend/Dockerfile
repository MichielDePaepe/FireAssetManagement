FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

FROM base AS development
RUN pip install --no-cache-dir -r requirements-dev.txt

FROM base AS production
RUN addgroup --system app && adduser --system --ingroup app app && mkdir -p /app/staticfiles && chown -R app:app /app
USER app
