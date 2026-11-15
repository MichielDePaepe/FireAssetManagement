---
id: task-01
title: CityGIS domain models and status catalog
status: done
complexity: medium
blocked-by: ~
---
## Goal
Model Fireplan vehicles, individual CityGIS vectors, and the four-column vector status catalog. Preserve existing data where possible and seed all supplied status rows through a migration.

## Context
The prototype in `backend/citygis/` is unverified. Read `.tasks/specs/2026-11-14-citygis-module.md` before changing it. The Fireplan vehicle and dispatch vector are different records; `pResourceCode` and `ResourceCode` are separate identifiers.

## Acceptance Criteria
- [x] Vehicle records store Fireplan ID, alphacode, plate, utilisation, chassis, and fleet status.
- [x] Vector records are independent and store vector code, p-fields, ResourceCode, source vehicle name, raw string status code, status timestamp, optional one-to-one vehicle link, and current/last-seen tracking.
- [x] Status records store only code, description, abbreviation, and color; all 17 screenshot rows are seeded by migration without the other table columns.
- [x] Tests verify the model constraints, string status codes, and complete four-column catalog data.

## Notes
Updated the prototype models, registered the app, and added `0002_catalog_and_source_presence` to remove unused catalog fields, correct screenshot wording for codes 91/92, and track source presence on vehicles/vectors. Added model/catalog tests. Four tests passed with Django's test runner on SQLite; pytest and Docker are unavailable in this environment.
