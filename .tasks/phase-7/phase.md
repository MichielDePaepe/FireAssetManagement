---
phase: 7
title: CityGIS page and project documentation
status: closed
opened: 2026-11-14
closed: 2026-11-14
---
## Goal
Add a staff-facing page for current vectors, linked vehicles, and operational status, and document the integration and its runtime requirements.

## Carry from phase 6
1. The staff API is available at `/api/citygis/`, manual refresh at `/api/citygis/refresh/`, and live snapshots at `/api/citygis/events/`; use the event name `citygis`.
2. The snapshot includes each vector's resolved status description/abbreviation/color, linked vehicle and current flag, the local catalog, last successful refresh, and a safe synchronization error state.

## Open follow-ups from phase 6
- API tests in `backend/citygis/tests/test_views.py` remain unexecuted because Django REST Framework/pytest are absent locally and Docker is inaccessible. Run them in the project container or CI if that environment becomes available.
- Live refresh against internal Fireplan/resources endpoints still needs validation on the target network.

## Exit Criteria
- The page displays a searchable vector list with linked vehicle/fleet details and operational status code, description, and supplied color.
- The page updates from SSE without a browser refresh and provides a manual synchronization button that queues the same Celery task.
- Loading, empty, disconnected, and source-error states are understandable; the last successful data snapshot remains visible during source errors.
- README, ARCHITECTURE.md, SPEC.md, and .env.example describe the resources-service base URL, one-minute Celery schedule, SSE behavior, and authentication/credential reuse.
- Frontend tests cover initial loading, error/disconnection states, displayed status colors, live snapshot updates, and manual refresh behavior.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.

## Tasks
- [x] task-01-citygis-ui.md
- [x] task-02-citygis-docs-and-validation.md

## Carry-forward

### Carry from phase 7
1. Run the backend API tests, full CityGIS pytest suite, frontend Vitest, Ruff, ESLint, and TypeScript checks in an environment with project dependencies and Docker/CI access before relying on the release.

### Open follow-ups from phase 7
- Recheck the CityGIS page/API after the backend service is responsive; `localhost:5174/api/health/` timed out after the code reload and Docker access was unavailable for a service restart.
- Phase 6 API tests were authored but have not run; execute them with the checks above.
- Live source synchronization was verified on 2026-11-15: 229 vehicles and 129 vectors imported, with one duplicate match logged.
