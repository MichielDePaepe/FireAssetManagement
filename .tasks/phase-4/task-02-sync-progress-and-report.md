---
id: task-02
title: Show Fireplan sync progress and report
status: done
complexity: high
blocked-by: task-01
---
## Goal
Show the Celery task's progress and final import report, including individual row errors, and keep completed reports available from task detail.

## Context
Use the existing task detail and SSE APIs and the stored result fields `added`, `updated`, `unchanged`, and `errors`. The finished task response is persisted in django-celery-results and can be reopened from the task ID.

## Acceptance Criteria
- [x] Fireplan sync tasks have a clear label in task overview/detail and show live progress using the current task UI.
- [x] After completion, the report shows added, updated, unchanged, and failed records with useful row context.
- [x] A completion toast offers an action that opens an accessible square-corner report modal.
- [x] The report can be reopened from task detail after navigation or refresh.
- [x] Frontend tests cover progress, success/report, failures, and reopening a completed report.

## Notes
- Added global tracking for the saved Fireplan Celery ID, SSE updates, a single completion/failure toast, and the report action.
- Task history and detail now label Fireplan syncs; the detail page shows summary counts and an accessible, keyboard-operable error report modal.
- New task/report UI tests pass; the full frontend suite passes (45 tests).
