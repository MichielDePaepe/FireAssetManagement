---
id: task-03
title: Source ownership and atomic refresh regressions
status: done
complexity: medium
blocked-by: task-02
---
## Goal
Verify that Fireplan and CityGIS remain authoritative for their current fields and that failed refreshes preserve the last successful state and valid relationship history.

## Context
Fireplan owns vehicle ID, alphacode, plate, utilisation, chassis, and fleet status. CityGIS owns vector identity, service, and current vector-vehicle matching. Pager-to-vector, RiC/AdC-to-vector, and operational assignment relationships are locally managed and must not be changed by source synchronization. The refresh currently fetches both source lists before applying the snapshot and saves refreshed Fireplan cookies in the same transaction as reconciled data.

## Acceptance Criteria
- [x] Repeated Fireplan vehicle updates retain the typed managed-object identity and update only Fireplan-owned vehicle fields.
- [x] Read-only CityGIS snapshot APIs continue to expose the authoritative service and vehicle projection without permitting source-field edits.
- [x] A failed fetch, invalid/incomplete snapshot, or persistence failure leaves the last successful current records and history unchanged and does not save a newly refreshed session.
- [x] Local operational assignments and RiC/AdC-to-vector relationships remain unchanged across successful CityGIS refreshes.
- [x] Relevant API, task, and synchronization tests pass; any unavailable Redis-backed test is recorded with its reason.

## Notes
- Source-failure regression now starts with known vehicle, vector, and active relationship history, then confirms all remain unchanged when a source fetch fails.
- Full backend suite: 133 passed, 1 skipped (`test_celery_worker_persists_progress_and_result`, gated for a live Redis broker). Explicitly enabling that test with the running Compose Redis hung while collecting the SSE stream; the run was interrupted and remains a follow-up.
- Frontend Vitest: 54 passed. Frontend ESLint and TypeScript checks passed.
- Django system check, migration drift check, and Ruff on all changed phase-9 Python files passed. Repo-wide Ruff still reports 15 legacy findings (10 line lengths, 3 import order, 2 `isinstance` style) in older files.
- The API health endpoint returned HTTP 200 from the container healthcheck. Host port 8001 is not published by the current Compose configuration, so the earlier host-route check remains unverified.
