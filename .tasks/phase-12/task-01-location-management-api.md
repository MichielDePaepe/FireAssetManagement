---
id: task-01
title: Staff location management API
status: done
complexity: high
blocked-by: ~
---
## Goal
Expose staff-only CRUD for the existing hierarchical Location model with validated parent and CityGIS service mapping rules.

## Context
Reuse `citygis.Location` and `citygis.Service`. A post is a location with kind `post`; CityGIS services are synchronized and source-owned. Existing inventory snapshots expose read-only location data, but no management endpoint exists.

## Acceptance Criteria
- [x] Staff can list, create, and update locations through a documented DRF API; non-staff users cannot access management operations.
- [x] Existing kinds (`post`, `building`, `room`, `other`), parent-child links, and unlinked locations remain supported.
- [x] Parent updates reject self-parenting and descendant cycles.
- [x] A service can be assigned only to a post location, and the existing one-service-to-one-location constraint is retained.
- [x] A location cannot be deleted while it has children or a mapped service; eligible leaf locations can be deleted.
- [x] Tests cover authorization, serialization, CRUD, hierarchy validation, service validation/cardinality, and protected deletion.

## Notes
- Added staff-only `GET/POST/PATCH/DELETE /api/locations/` endpoints using the existing Location and Service models.
- Added input validation for hierarchy cycles and service mapping; deletion is blocked for parents and mapped posts.
- `citygis/tests/test_location_api.py`: 5 passed. Changed-file Ruff: passed. No migration required.
