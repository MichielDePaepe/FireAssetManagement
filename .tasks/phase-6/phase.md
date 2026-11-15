---
phase: 6
title: Scheduled and live data delivery
status: closed
opened: 2026-11-14
closed: 2026-11-14
---
## Goal
Run the synchronization every minute through Celery Beat and expose a staff-only snapshot and SSE stream that reflect saved data changes.

## Carry from phase 5
1. Use `Vehicle.is_current`/`Vector.is_current` and `last_seen_at` as the source-presence markers; synchronization validates full snapshots, maps trimmed case-insensitive names, and logs duplicate vector matches.
2. Keep `CITYGIS_RESOURCES_BASE_URL` as the configured resources-service origin and use `citygis.client` for bounded same-origin requests.

## Open follow-ups from phase 5
- Live access to the internal Fireplan and resources-service endpoints has not been exercised with production credentials. Verify it in the target network after the integration is deployed.
- The container pytest suite could not run in this environment: pytest is absent and access to Docker's socket is denied. CityGIS tests passed through Django's runner with SQLite; report this limitation when completing verification.

## Exit Criteria
- A Celery Beat process is added to the existing Compose deployment and schedules the CityGIS refresh at a one-minute interval without adding another broker, result model, or event bus.
- Scheduled runs do not create an unbounded stream of persisted task results. A user-requested manual run uses the same Celery task and existing task-ID/result infrastructure.
- Authenticated staff can retrieve the current snapshot and start a manual refresh; other users cannot access CityGIS data or trigger refreshes.
- The SSE snapshot includes vehicles, vectors, status catalog, and each vector's current vehicle association. It emits changes after a successful sync, including new vehicles, new vectors, status changes, and changed associations.
- SSE uses the existing transport and database polling pattern. A source failure leaves the last successful snapshot intact and is logged.
- Tests cover access control, manual task creation, snapshot serialization, SSE change delivery, and scheduled-task configuration.

## Tasks
- [x] task-01-citygis-periodic-refresh.md
- [x] task-02-citygis-staff-api-and-sse.md
