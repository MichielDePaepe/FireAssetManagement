---
phase: 14
title: Documentation and verification
status: pending
opened: ~
closed: ~
---
## Goal
Update the product and architecture documentation and verify the location-management API and user flow.

## Carry from phase 13
1. Document the staff `/locations` page, location CRUD, CityGIS service choices, and the read-only post overview endpoint and fields.
2. Preserve the source boundary: services, vectors, statuses, and vehicles stay CityGIS/Fireplan-owned; a post is a Location, and vehicle association is shown through the current vector link.

## Open follow-ups from phase 13
- Verify the authenticated `/locations` page in a browser; the browser access host was unavailable during phase 13.
- Run Django system and migration-drift checks if the project container is available; they were not run in phase 12, which introduced no schema changes.

## Exit Criteria
- SPEC.md, ARCHITECTURE.md, and README.md describe the location-management page, service-to-post mapping, derived vehicle display, and scope boundaries accurately.
- Backend tests cover staff access, location CRUD, parent-cycle prevention, service mapping validation, protected deletion, and post overview data.
- Frontend tests cover hierarchy navigation, create/edit/delete behavior, post vector and vehicle display, and loading/error/empty states.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.

## Tasks
