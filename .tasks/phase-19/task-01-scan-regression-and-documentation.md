---
phase: 19
task: 1
title: Scan regression and documentation
status: done
blocked-by: []
---
## Goal
Run the scan and project verification suites, review architecture/spec documentation, and record any required updates.

## Acceptance Criteria
- [x] Backend scan and pager relationship tests pass, including complete URL, layout variants, invalid/unknown scans, and auth.
- [x] Frontend scan and pager flow tests pass; frontend lint and typecheck pass.
- [x] Backend pytest, Ruff, Django checks, and migration drift check pass or their environment limits are recorded.
- [x] `SPEC.md`, `ARCHITECTURE.md`, README, and dependency notes are reviewed and updated where requirements or code warrant it.

## Notes
- Full backend suite without opt-in broker test: 159 passed, 1 skipped. `make test` with `RUN_CELERY_INTEGRATION=true` stalled at the Celery/Redis/SSE streaming test after 87%; interrupted after several minutes. The standalone task API integration test remains unverified in this environment.
- Full frontend suite: 16 files, 81 tests passed. Frontend lint and TypeScript checks passed.
- Ruff check and format check passed; Django system check passed; `makemigrations --check --dry-run` reported no changes.
- Reviewed and updated SPEC, ARCHITECTURE, README, and QR scanner dependency notes for the scan endpoint, full-URL matching, camera constraints, and free-pager guard.
