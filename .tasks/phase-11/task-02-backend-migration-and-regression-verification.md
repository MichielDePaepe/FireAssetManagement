---
id: task-02
title: Verify migrations, source ownership, history, and backend quality
status: done
complexity: high
blocked-by: task-01
---
## Goal
Run the phase-11 backend verification against migrations, historical relationships, source ownership, authorization, source failures, and repository Python quality.

## Context
This task covers the phase-11 backend acceptance criteria. Do not apply migrations to a live or shared database. Use the local Compose test database if available. The existing open follow-up notes 15 repo-wide Ruff findings; report/fix within the lint criterion without broadening runtime behavior.

## Acceptance Criteria
- [x] Backend pytest passes, including migration preservation, source ownership, unmapped services, one-active-assignment cardinality, observation separation, timestamp distinctions, history transitions, API access control, and source failure behavior.
- [x] Django system checks pass.
- [x] Migration drift check passes without creating a migration.
- [x] Python lint passes, or each unavailable/remaining check is recorded with exact reason and affected files.
- [x] The previously hanging SSE integration test is either verified successfully or explicitly recorded as an unresolved follow-up with reproduction evidence; it must not be silently treated as passing.

## Notes
- Use bounded execution for the previously hanging integration test; do not leave a test process running indefinitely.
- Full backend suite passed: 139 passed, 1 opt-in Redis integration skipped. The opt-in test passed separately in 12.46 seconds with Compose Redis; pytest teardown logged one Celery pidbox error and an open-session warning.
- `manage.py check`, `makemigrations --check --dry-run`, and `ruff check .` pass. Fixed 15 Ruff findings in 4 files without model state changes.
- `ruff format --check .` still reports 17 files; global formatting was left as follow-up because format checking is not part of the repo's required lint checks and would reformat unrelated/generated files.
