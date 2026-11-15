---
id: task-01
title: CityGIS staff page and live updates
status: done
complexity: medium
blocked-by: ~
---
## Goal
Connect the existing CityGIS page prototype to typed API contracts, staff routing/navigation, live SSE snapshots, and user-visible synchronization state.

## Context
Use `/api/citygis/`, `/api/citygis/refresh/`, and `/api/citygis/events/` with the `citygis` event. Preserve the existing snapshot during source errors. Reuse the current API helper and square-corner UI.

## Acceptance Criteria
- [x] Strict TypeScript contracts cover vehicles, vectors, status catalog, sync state, and snapshots.
- [x] Staff can navigate to a protected CityGIS page; non-staff users do not see the link or page.
- [x] Searchable vector table displays linked fleet details and catalog-derived status code/description/color.
- [x] SSE updates the existing page in place and a manual refresh queues the existing Celery task.
- [x] Loading, empty, disconnected, source-error, and stale vehicle/vector states are understandable.
- [x] Tests cover initial loading, disconnection/source errors, status color, live updates, and manual refresh.

## Notes
Preserved the existing shell and API patterns. Added staff routing/navigation, typed CityGIS API/SSE contracts, sync health and stale-record feedback, and page tests. Test execution is recorded in task-02 because frontend dependencies are not installed in this environment.
