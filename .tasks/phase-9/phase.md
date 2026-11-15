---
phase: 9
title: Source synchronization and relationship history
status: closed
opened: 2026-11-15
closed: 2026-11-15
---
## Goal
Keep Fireplan and CityGIS authoritative for their respective data and preserve source-managed and locally managed relationship history with accurate timestamps.

## Carry from phase 8
1. Store a CityGIS relationship's source-effective timestamp separately from the synchronization-observed timestamp; leave the effective time unknown when the source provides none.
2. Apply complete source snapshots transactionally and avoid duplicate history for unchanged vector-service and vector-vehicle relationships.

## Open follow-ups from phase 8
- The post-oriented registration UI and staff editing of pager/vector and RiC/AdC/vector relationships move to phase 10.
- The Redis-backed Celery/SSE integration test was explicitly attempted with the running Compose broker, but hung while collecting SSE and was interrupted; investigate the stream completion before treating it as verified.
- Repo-wide Ruff reports 15 findings in older files (10 line lengths, 3 import-order findings, and 2 `isinstance` style findings); all changed phase-9 files pass Ruff.
- The API health endpoint returned HTTP 200 from the container healthcheck, but host port 8001 is not published in the active Compose configuration, so the host-route check remains unverified.

## Exit Criteria
- Fireplan remains authoritative for currently imported vehicle identity and attributes; CityGIS remains authoritative for vectors, vector services, and vector-vehicle associations.
- Source-managed data is read-only in the application, and existing source identifiers and matching rules are inspected before they are changed.
- The history stores source-effective time when the source provides an applicable timestamp and separately stores when synchronization observed each change. Unknown effective times remain unknown.
- A physical asset has at most one active operational assignment, independently of any physical-location observation.
- Local assignments and CityGIS vector-service and vector-vehicle associations retain history. Identical sync snapshots do not create duplicate history.
- Failed or incomplete source refreshes do not partially update state or end valid historical relationships.

## Tasks
- [x] task-01-citygis-relationship-history-schema.md
- [x] task-02-idempotent-source-relationship-sync.md
- [x] task-03-source-ownership-and-failure-regressions.md

## Execution Notes
- Live CityGIS read returned 129 records; the only timestamp field was `LastStatusTimeUpdated`, which describes status changes, so relationship-effective times remain unknown.
- Verification: backend 133 passed and 1 Redis-gated test skipped; frontend 54 passed; ESLint, TypeScript, Django system check, migration drift, and changed-file Ruff checks passed.
