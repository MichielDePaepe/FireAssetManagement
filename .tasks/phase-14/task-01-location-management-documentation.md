---
id: task-01
title: Document location management
status: done
complexity: medium
blocked-by: ~
---
## Goal
Document the staff location page, location API, CityGIS service-to-post mapping, and derived post overview consistently across product and architecture documentation.

## Context
Fase 12-13 reused `citygis.Location` and `citygis.Service` and added the staff `/locations` UI. The read-only endpoints are `GET /api/locations/services/` and `GET /api/locations/{id}/overview/`; location CRUD is staff-only. CityGIS/Fireplan fields remain source-owned, and a vehicle is shown through the current vector link rather than a separate post assignment.

## Acceptance Criteria
- [x] `SPEC.md` describes the location-management and read-only post-overview requirements and their scope boundaries.
- [x] `ARCHITECTURE.md` lists the location API endpoints and documents validation, deletion rules, source ownership, and derived vehicle display.
- [x] `README.md` explains where staff manage locations, how service mapping and post overview work, and what remains out of scope.
- [x] Documentation matches the current endpoints and frontend behavior; no new environment variables or dependencies are introduced.

## Notes
- Added SPEC FR-033, all four staff location routes and behavior limits in ARCHITECTURE, and the staff workflow/scope in README.
- Verified endpoint paths, fields, ownership, and deletion rules against the phase-12 API and phase-13 UI; no env var or dependency was added.
