---
id: task-03
title: Compose-health, documentatie en regressieverificatie
status: done
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Integrate the single Suivo consumer and reliable Celery Beat scheduler into Compose, and verify the full push/reconciliation path.

## Context
Keep the approved Django, Celery, Redis, PostgreSQL, celery-progress and django-celery-results topology. The consumer is a dedicated long-running process; do not introduce another queue or event store.

## Acceptance Criteria
- [x] Compose starts one consumer with configured REST/WebSocket environment, database access, health/restart behavior and graceful stop.
- [x] Celery Beat scheduler state is persistent across container restarts and deployment docs explain the single-instance constraint.
- [x] Operational logs expose connection/reconnect/error state without secrets or raw telemetry.
- [x] Focused backend/frontend tests, Python lint, ESLint, TypeScript, migration checks and `git diff --check` pass where available.
- [x] README and ARCHITECTURE accurately describe service roles, daily/manual sync, and the unbuffered push recovery limit.

## Notes
- Full verification completed on the development Compose stack: `pytest -q` (294 passed, 1 skipped for explicit Redis-broker opt-in), Ruff, migration drift check, Compose config, `git diff --check`, full Vitest (153 passed), TypeScript and ESLint all passed.
- One issue found during verification: `compose.dev.yaml` previously still pointed Beat at `/tmp`; the override now mounts `celerybeat_data` and the running Beat process created the persistent scheduler file.
