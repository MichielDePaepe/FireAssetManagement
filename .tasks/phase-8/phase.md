---
phase: 8
title: Managed-object model and migration
status: closed
opened: 2026-11-15
closed: 2026-11-15
---
## Goal
Introduce a reusable domain model for physical assets, operational vectors, locations, services, and typed relationships while preserving existing pager, vehicle, and RiC-code data.

## Carry from phase 7
1. Run the backend API tests, full CityGIS pytest suite, frontend Vitest, Ruff, ESLint, and TypeScript checks in an environment with project dependencies and Docker/CI access before relying on the release.

## Open follow-ups from phase 7
- Recheck the CityGIS page/API after the backend service is responsive; phase 8 verified backend tests, but `localhost:8081/api/health/` reset the connection while the container healthcheck showed intermittent timeouts.
- Phase 6 API tests were authored but had not run; the full suite now passes, including the CityGIS API tests.
- Live source synchronization was verified on 2026-11-15: 229 vehicles and 129 vectors imported, with one duplicate match logged.

## Exit Criteria
- Physical assets have shared base data and structured type-specific records; the first physical asset types are pagers and vehicles.
- Vectors remain distinct operational objects with stable identities independent of the currently associated vehicle.
- Locations support a simple parent-child hierarchy, and posts are represented as locations.
- Services are normalized records referenced by vectors and optionally by locations. A vector's post is derived from its service only when that service maps to a post location; unmatched services remain unlinked.
- Operational assignment, observed physical location, and derived expected physical location are distinct concepts.
- RiC/AdC records remain separate from physical assets and can be related to vectors with history.
- Existing records are migrated without loss or duplication.

## Tasks
- [x] task-01-managed-object-and-asset-types.md
- [x] task-02-locations-services-and-vectors.md
- [x] task-03-relationships-and-location-semantics.md
- [x] task-04-migration-and-regression-coverage.md

## Execution Notes
- All four tasks are complete. Populated development records were preserved by migrations; backend and frontend regression suites pass except for the documented live-Redis skip. Repo-wide Ruff has legacy findings documented in task 4.
