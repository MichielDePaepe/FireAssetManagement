---
id: task-02
title: Staff CityGIS snapshot API and SSE
status: blocked
complexity: high
blocked-by: task-01
---
## Goal
Expose the CityGIS snapshot and manual refresh to staff users and stream database changes through the existing SSE transport.

## Context
Read the approved CityGIS spec. Snapshot contents are vehicles, vectors with their current vehicle, status catalog, and refresh time. Resolve status description/color from the four-column local catalog while preserving unknown raw string status codes. Reuse the existing session authentication, Celery task ID, and one-second SSE database polling approach.

## Acceptance Criteria
- [x] Staff-only GET returns a complete snapshot; authenticated non-staff users are denied.
- [x] Staff-only POST queues the existing CityGIS task and returns its Celery task ID/status; non-staff users are denied.
- [x] The SSE endpoint rejects unauthenticated/non-staff requests and emits an initial snapshot plus subsequent changed snapshots.
- [x] Snapshot serialization includes current/stale vehicle state and vector-to-vehicle associations, and resolves status code, description, and color from the catalog.
- [x] Snapshot and SSE expose last attempt, last success, and a secret-safe source error from a singleton synchronization-state row; this is not a task-result or event-history model.
- [x] SSE emits new vehicles, vectors, status changes, and changed associations without browser refresh, using existing SSE infrastructure and no event bus.
- [ ] Tests cover authorization, snapshot serialization, manual task enqueue, initial SSE snapshot, and changed snapshot emission.

## Notes
Added DRF serializers/views, CityGIS API routes, task-detail allowlisting, and the singleton `CityGISSyncState` model/migration so periodic failures are visible without storing scheduled task results. API tests are written in `backend/citygis/tests/test_views.py`. They could not run locally: Django REST Framework/pytest are not installed on the host, and Docker access is denied. Run them in the project container or CI before relying on the API.
