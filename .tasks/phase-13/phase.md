---
phase: 13
title: Location tree and post overview UI
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Add a dedicated Beheer → Locaties page to maintain the location hierarchy and review the CityGIS vectors and linked vehicles for each mapped post.

## Carry from phase 12
1. Use `GET /api/locations/` and the location detail endpoints for hierarchy CRUD. The writable fields are `name`, `kind`, `parent_id`, and `service_id`; server validation rejects parent cycles, non-post service mappings, and source-owned fields.
2. Load CityGIS service choices from `GET /api/locations/services/`; each row includes `id`, `abbreviation`, and `location_id` (null when unassigned). Service records remain read-only.
3. Load selected-location data from `GET /api/locations/{id}/overview/`. It returns location, mapped service or null, and current service vectors with resolved status and linked vehicle. Do not create a separate vehicle-to-post association.

## Open follow-ups from phase 12
- Django system and migration-drift checks were not run at phase close because Docker socket access was denied for a one-off Compose command. No schema changes were introduced; include these checks in phase 14 verification if the test environment permits.

## Exit Criteria
- Staff can add a top-level location or child, edit its name, kind, parent, and eligible service mapping, and delete only eligible unlinked leaf locations.
- The page presents a navigable hierarchy and details for the selected location; locations without a service remain usable.
- A post detail shows its linked CityGIS service and that service's vectors, with operational status and current linked Fireplan vehicle.
- CityGIS and Fireplan fields remain read-only; vehicles' post association is derived through the existing vector-service mapping.
- Loading, empty, validation, and API error states are handled accessibly, with the existing square-corner component style.

## Tasks
- [x] task-01-location-tree-and-management-ui.md
- [x] task-02-post-overview-panel.md

## Execution Notes
- Full frontend suite: 71 passed. ESLint, TypeScript, and production build passed. Vite reported existing Zod dependency annotation warnings.
- Browser visual verification could not be performed because the CUA browser access host was unavailable.

## Carry-forward
- Browser visual verification remains open for phase 14 user-flow verification.
