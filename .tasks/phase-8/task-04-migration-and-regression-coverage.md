---
id: task-04
title: Migrate existing records and verify compatibility
status: done
complexity: high
blocked-by: task-01, task-02, task-03
---
## Goal
Migrate existing pager, vehicle, vector, service, and RiC/AdC records into the shared model without data loss, and verify compatibility with the existing APIs and source integrations.

## Context
The existing CityGIS and Fireplan integrations, pager APIs, and standalone RiC/AdC CRUD must continue to work. Phase 7 carry-forward includes unexecuted backend API tests and a full verification pass; run the relevant checks when dependencies and local services are available and record blockers accurately.

## Acceptance Criteria
- [x] Database migrations preserve every existing pager, vehicle, vector, and RiC/AdC record and its source identifiers/fields.
- [x] Existing pager CRUD, Fireplan pager synchronization, CityGIS snapshots, and RiC/AdC CRUD use the migrated records without losing current behavior.
- [x] Migration tests cover both populated and empty databases and reject unsafe duplicate or orphaned links.
- [x] Relevant backend API and synchronization tests are run or any environment blocker is documented; frontend regression checks are run for changed API contracts when available.
- [x] The task notes identify any follow-up needed in phase 9 for source-history ingestion or in phase 10 for the post-oriented UI.

## Notes
- Added populated/empty migration coverage, duplicate assignment and orphan FK rejection, and CityGIS API assertions for typed identity, service, post, and vehicle data.
- Corrected test isolation assumptions exposed by seeded RiC rows, non-staff fixtures, naive test timestamps/stream bytes, and patching Django LazySettings directly.
- Full backend: 118 passed, 1 skipped (live Redis broker integration); frontend: 54 Vitest passed, ESLint and TypeScript pass. Django check and migration drift check pass.
- Changed-file Ruff passes. Repo-wide Ruff still reports 15 existing issues in the legacy CityGIS client/migrations and seeded RiC migration; a live Redis-backed task test remains skipped.
- Phase 9: preserve source-effective and sync-observed times separately and ingest vector service/vehicle changes transactionally without duplicate history. Phase 10: add post-oriented registration and editing UI for local pager and RiC/vector relationships.
