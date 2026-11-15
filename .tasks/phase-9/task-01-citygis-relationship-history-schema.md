---
id: task-01
title: CityGIS vector relationship history schema
status: done
complexity: high
blocked-by: ~
---
## Goal
Store history for CityGIS vector-service and vector-vehicle associations, preserving source-effective and synchronization-observed times as separate facts.

## Context
CityGIS vectors are identified by `pResourceCode`; `ResourceCode` remains a distinct field. Service association comes from `pServiceAbbreviation`. Vehicle matching uses CityGIS `Name` against Fireplan `alphacode`. A live read on 2026-11-15 returned 129 records and only the `LastStatusTimeUpdated` timestamp, which describes status changes and must not be used as an association effective time. The phase 8 migration already stores the current projection and each vector's `last_seen_at`.

## Acceptance Criteria
- [x] Separate typed history models represent vector-service and vector-vehicle association states, including unlinked/unmatched states and original source values.
- [x] History has nullable source-effective time and a distinct observation time; the status timestamp is never substituted for relationship-effective time.
- [x] A conditional database constraint permits at most one active history row per vector and relationship kind.
- [x] A migration backfills each existing vector's known service and vehicle projection without changing vector/vehicle IDs or source fields; it uses `last_seen_at` as the observation time only when available.
- [x] Migration tests cover populated and empty databases and verify unknown effective times remain null.

## Notes
- Added `VectorServiceHistory` and `VectorVehicleHistory` with active-row constraints, nullable effective/observed times, source values, and safe references to normalized targets.
- Live 129-record CityGIS read exposed only `LastStatusTimeUpdated`, a status timestamp; it is not used for relationship history.
- Migration tests pass for populated and empty tables. The development database backfilled 130 vectors; IDs, links, source fields, and observed times matched the prior projection. Effective times remain null.
