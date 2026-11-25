---
id: task-03
title: Compose-health, documentatie en regressieverificatie
status: pending
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Integrate the single Suivo consumer and reliable Celery Beat scheduler into Compose, and verify the full push/reconciliation path.

## Context
Keep the approved Django, Celery, Redis, PostgreSQL, celery-progress and django-celery-results topology. The consumer is a dedicated long-running process; do not introduce another queue or event store.

## Acceptance Criteria
- [ ] Compose starts one consumer with configured REST/WebSocket environment, database access, health/restart behavior and graceful stop.
- [ ] Celery Beat scheduler state is persistent across container restarts and deployment docs explain the single-instance constraint.
- [ ] Operational logs expose connection/reconnect/error state without secrets or raw telemetry.
- [ ] Focused backend/frontend tests, Python lint, ESLint, TypeScript, migration checks and `git diff --check` pass where available.
- [ ] README and ARCHITECTURE accurately describe service roles, daily/manual sync, and the unbuffered push recovery limit.

## Notes
