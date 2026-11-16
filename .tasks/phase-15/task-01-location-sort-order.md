---
id: task-01
title: Add optional location sort name
status: done
complexity: high
blocked-by: ~
---
## Goal
Persist an optional per-location sort name and use it to order siblings in the location tree. Expose the field only in a collapsed-by-default “Geavanceerde opties” section of create/edit forms.

## Context
The hierarchy and form live in `frontend/src/pages/LocationsPage.tsx`; currently `sortLocations` sorts by name. Staff API writes use `LocationManagementSerializer` in `backend/citygis/serializers.py`. The `Location` model is in `backend/citygis/models.py`. Keep the sort name locally owned and distinct from CityGIS service data. Preserve unrelated local edits in the page.

## Acceptance Criteria
- [x] A nullable-or-blank-safe local `sort_name` field is persisted, validated, and included in staff location create/list/update API contracts.
- [x] Siblings with a nonblank sort name appear first, alphabetically by sort name, then alphabetically by location name; blank sort names follow and are ordered by name; comparisons use `nl-BE`, case-insensitive numeric-aware ordering, with ID as a stable tie-breaker.
- [x] Create and edit forms include a labeled sort-name input inside native or equivalently accessible advanced options, collapsed on initial render; existing values load and save correctly.
- [x] Tests cover custom ordering, blank-last behavior, name fallback, persistence/API round trip, and the default-collapsed form with edit/create behavior.
- [x] Relevant documentation describes the field and sorting behavior; migration, backend tests/lint, and frontend tests/type checks are verified or limitations recorded.

## Notes
- Added `Location.sort_name` with migration and staff API round trip; hierarchy siblings sort by populated Dutch locale-aware, numeric-aware sort name, then name, with blank values last and ID as a stable tie-breaker.
- Added the labeled field in default-collapsed advanced options for create/edit; whitespace is saved as blank. Updated SPEC, ARCHITECTURE, README, and API test fixtures.
- Verification: backend 149 passed, 1 Redis-gated skip; Ruff passed. Frontend 72 passed; focused location tests 11 passed; ESLint and TypeScript passed. Migration drift and Django system checks were blocked by denied Docker socket access.
