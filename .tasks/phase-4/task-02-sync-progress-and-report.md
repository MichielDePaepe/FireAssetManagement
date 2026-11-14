---
id: task-02
title: Show Fireplan sync progress and report
status: pending
complexity: high
blocked-by: task-01
---
## Goal
Show the Celery task's progress and final import report, including individual row errors, and keep completed reports available from task detail.

## Context
Use the existing task detail and SSE APIs and the stored result fields `added`, `updated`, `unchanged`, and `errors`. The finished task response is persisted in django-celery-results and can be reopened from the task ID.

## Acceptance Criteria
- [ ] Fireplan sync tasks have a clear label in task overview/detail and show live progress using the current task UI.
- [ ] After completion, the report shows added, updated, unchanged, and failed records with useful row context.
- [ ] A completion toast offers an action that opens an accessible square-corner report modal.
- [ ] The report can be reopened from task detail after navigation or refresh.
- [ ] Frontend tests cover progress, success/report, failures, and reopening a completed report.

## Notes
