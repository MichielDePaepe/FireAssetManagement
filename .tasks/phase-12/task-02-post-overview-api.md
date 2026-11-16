---
id: task-02
title: Staff post overview API
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Expose the read-only CityGIS and Fireplan data needed by the location page to show mapped post services, vectors, operational status, and current linked vehicles.

## Context
Use the existing CityGIS vector, status, and vehicle associations. A vector's post is derived only through its service mapping to a post location. Vehicle association remains CityGIS-owned and must not be copied into a local post relationship.

## Acceptance Criteria
- [x] A staff-only endpoint returns each location's hierarchy and service mapping, with post overview data for mapped services.
- [x] A staff-only read-only endpoint lists normalized CityGIS services and identifies any mapped location so the UI can offer valid service choices.
- [x] Post overview includes only current vectors using that service, each vector's resolved status information, and its current linked vehicle details.
- [x] Unmapped services and locations without a service remain valid and return an empty overview without errors.
- [x] Synchronized CityGIS and Fireplan fields are read-only; no endpoint permits changing their source records or associations.
- [x] Tests cover staff access, service choices, unmapped and mapped posts, vector status/current vehicle serialization, and source-ownership boundaries.

## Notes
- Added `GET /api/locations/services/` and `GET /api/locations/{id}/overview/` for service choices and read-only post data.
- Overview returns current service vectors with resolved status and linked vehicle; location input rejects unknown source-owned fields.
- Location API tests: 10 passed; full backend: 149 passed, 1 Redis-gated test skipped; Ruff, Vitest (61), ESLint, and TypeScript passed.
- Django system and migration-drift checks could not run at close because Docker socket access was denied for the one-off command; no model or migration changes were made.
