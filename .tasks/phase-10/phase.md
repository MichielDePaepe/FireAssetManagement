---
phase: 10
title: Registration and relationship management
status: closed
opened: 2026-11-15
closed: 2026-11-15
---
## Goal
Let staff find existing objects by type, manage their relationships, and review source-owned context without changing authoritative data.

## Carry from phase 9
- Use the CityGIS relationship history and current projection from phase 9. Keep source-effective times unknown when CityGIS provides no relationship-specific timestamp; retain synchronization-observed times separately.
- Preserve the verified ownership boundary: Fireplan and CityGIS source fields remain authoritative, and local pager/vector and RiC/AdC/vector links stay application-managed.

## Open follow-ups
- Visual verification of the authenticated inventory page remains open: the browser tool could not bind the existing Chrome tab. The Vite route returned HTTP 200 earlier in the phase.
- Investigate why the Celery/SSE integration test hangs while collecting its stream even with the Compose Redis broker available.
- Resolve or explicitly disposition the 15 repo-wide legacy Ruff findings before final verification.
- Confirm the intended host route for API health; the active Compose file does not publish port 8001, while the internal health endpoint returns HTTP 200. The frontend container reports unhealthy although its Vite route responds.

## Exit Criteria
- Staff can view pager, vector, and RiC/AdC records, with source-owned location, service, vehicle, and status context where applicable.
- Staff select a managed-object type, search its compact list, and manage that object's compatible relationships in a focused modal.
- The inventory tables have CityGIS-style sortable headers, separate vector and RiC/AdC fields, and a color-coded vector status.
- Single-link dialogs fit their content and the searchable dropdown opens below and outside the modal.
- One-to-one relationships use a searchable single choice; one-to-many relationships use searchable available/linked columns.
- Staff can link a pager to at most one vector and a RiC/AdC record to at most one vector; a vector can have multiple pagers and codes.
- Staff can edit only application-owned links; source-managed CityGIS and Fireplan values remain read-only.
- The current type and relation choices are explicit and localized so future asset types can be added without changing existing links; future asset types remain out of scope.
- The phase does not add physical inventory checks, discrepancy reports, or corrective workflows.

## Tasks
- [x] task-01-inventory-api-and-relationships.md
- [x] task-02-post-inventory-frontend.md

## Execution Notes
- Backend suite: 139 passed, 1 Redis/SSE integration test skipped; explicit enabled run hung while collecting SSE and was interrupted.
- Frontend suite after inventory UI corrections: 61 passed; ESLint, TypeScript, and production build passed. Changed-file Ruff, Django system check, and migration drift checks passed earlier in the phase.
- The Vite `/inventory` route returned HTTP 200 earlier in the phase, but a screenshot of the authenticated page could not be captured because the browser tool could not bind the existing Chrome tab. This remains a phase-11 follow-up.
