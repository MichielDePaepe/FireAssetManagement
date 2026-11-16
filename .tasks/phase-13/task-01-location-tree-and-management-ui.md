---
id: task-01
title: Location tree and management UI
status: done
complexity: high
blocked-by: ~
---
## Goal
Add the staff-facing Beheer → Locaties route with a navigable hierarchy and forms to create, edit, and delete locations.

## Context
Use the existing staff-only API. `GET /api/locations/` returns `id`, `name`, `kind`, `parent_id`, and `service_id`; CRUD uses the same collection/detail URLs. Service choices come from `GET /api/locations/services/` and are read-only CityGIS records. Preserve the project square-corner UI style and keep source-owned fields out of edit forms.

## Acceptance Criteria
- [x] A staff-only `/locations` page is linked from Beheer and loads the existing hierarchy into an accessible, navigable tree.
- [x] Staff can create root locations and children, edit name/kind/parent, and map or unmap a CityGIS service only for posts.
- [x] Parent and service choices exclude invalid choices where possible; server validation errors remain visible and associated accessibly with the form.
- [x] Delete is offered only for unlinked leaf locations and API errors are reported accessibly.
- [x] Loading, empty, and API error states are handled; locations without services remain usable.
- [x] Frontend tests cover route/navigation, hierarchy selection, create/edit/delete actions, validation errors, and loading/empty/error states.

## Notes
- Added typed location API methods, the staff `/locations` route, Beheer navigation, accessible tree selection, and create/edit/safe-delete forms.
- Parent selection excludes the location and descendants; service choices include only unassigned services or the current mapping.
- Moved CityGIS service guidance to a full-width line so the service selector aligns with the adjacent parent selector.
- `LocationsPage` and `AppLayout` tests: 9 passed; ESLint and TypeScript passed.
