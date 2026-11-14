---
id: task-01
title: Add staff Fireplan sync control
status: done
complexity: medium
blocked-by: ~
---
## Goal
Let staff start a Fireplan pager synchronization from the pager page and resume following its Celery ID after navigation or reload.

## Context
Use `POST /api/fireplan/sync-pagers/`, which returns the existing Celery `task_id` and `PENDING` status. Keep the control staff-only and reuse existing API/session/CSRF helpers, task detail, and SSE progress infrastructure. The backend task name is `fireplan.sync_pagers`.

## Acceptance Criteria
- [x] The pager page shows a sync action only to staff and disables duplicate submissions while a start request is pending.
- [x] The action starts the task and keeps its Celery ID available after navigation or reload.
- [x] Staff can reopen the task and see progress while it runs; errors starting the task have an accessible message.
- [x] Frontend tests cover staff visibility, queue response, persisted task ID, and request failure.

## Notes
- Added the staff-only pager control, a persisted link to the last sync, and typed API access to the existing Fireplan start route.
- The focused sync-control tests pass.
