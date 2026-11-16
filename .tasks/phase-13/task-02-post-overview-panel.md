---
id: task-02
title: Read-only post overview panel
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Show the selected location's mapped CityGIS service and its current vectors, operational status, and linked Fireplan vehicle.

## Context
Fetch `GET /api/locations/{id}/overview/`. It returns the selected location, mapped service or null, and current vectors with `status_description`, `status_color`, and `vehicle`. A post is still a Location. Keep CityGIS and Fireplan data read-only; derive post association through vector service mapping and do not create another vehicle-to-post relationship.

## Acceptance Criteria
- [x] Selecting a mapped post shows its service and current vectors with operational status and linked vehicle details.
- [x] A post without a mapped service and non-post locations remain selectable and show useful empty/details states.
- [x] The overview refreshes when selection changes and handles loading, empty, and API error states accessibly.
- [x] Source-owned vector, status, and vehicle fields are displayed without edit controls.
- [x] Frontend tests cover mapped/unmapped post details, vector status colors and vehicle fields, and loading/error/empty states.

## Notes
- Added the selected post's CityGIS overview with read-only service, current vector, color-coded status, and linked vehicle details.
- Posts without a service and non-post locations show distinct empty guidance; loading and endpoint failures are announced accessibly.
- Full Vitest: 71 passed. ESLint and TypeScript passed; production Vite build passed with existing Zod annotation warnings.
- Browser visual inspection was unavailable because the CUA browser host was unavailable; carry this into phase 14 user-flow verification.
