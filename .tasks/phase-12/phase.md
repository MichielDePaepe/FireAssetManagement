---
phase: 12
title: Location management API
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Expose staff-only creation, editing, listing, and safe deletion of hierarchical locations using the existing location and CityGIS service records.

## Carry from phase 11
1. Verify the inventory page through the staff-facing route and preserve its API boundary: CityGIS/Fireplan values remain read-only; pager and RiC/AdC vector links use the history-backed inventory endpoints.
2. In a browser-capable environment, visually verify the authenticated type-driven sortable table and relationship modal, including separated vector/RiC columns, CityGIS status colors and weight, toolbar placement, the below-modal dropdown, and filtered choices; frontend tests, build output, and an HTTP 200 from the Vite route do not prove the rendered authenticated experience.

## Open follow-ups from phase 11
- If repo-wide formatting becomes a required CI gate, format the 17 files reported by `ruff format --check .` and review the resulting diff before enabling it.
- Investigate the Celery pidbox teardown error and lingering database sessions from the opt-in Redis/SSE integration test if they recur or affect CI; the test itself currently passes.

## Exit Criteria
- Existing location records and parent-child relationships are preserved.
- Locations retain the existing post, building, room, and other kinds; a post remains a location, not a separate entity.
- A CityGIS service can optionally be mapped to a post location; service source data remains read-only and one service maps to at most one location.
- Parent updates reject self-parenting and cycles; service mapping is only accepted for post locations.
- Locations with children or a mapped CityGIS service cannot be deleted.
- Staff-only endpoints return enough location, service, vector, status, and linked vehicle data to render a post overview without allowing edits to synchronized fields.

## Tasks
- [x] task-01-location-management-api.md
- [x] task-02-post-overview-api.md

## Execution Notes
- Location API tests: 10 passed. Full backend suite: 149 passed, 1 Redis-gated integration skipped. Full Ruff, frontend Vitest (61), ESLint, and TypeScript checks passed.
- Django system and migration-drift checks were not run because Docker socket access was denied for the final one-off command; no schema changes were introduced.
