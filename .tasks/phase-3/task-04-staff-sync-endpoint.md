---
id: task-04
title: Add staff-only sync start endpoint
status: in-progress
complexity: medium
blocked-by: task-03
---
## Goal
Provide an authenticated staff-only API endpoint that queues the pager synchronization Celery task and returns its existing task ID.

## Context
Phase 3 spec: `.tasks/specs/2026-11-14-fireplan-pager-synchronization.md`. The frontend sync button and task-list/report presentation belong to phase 4. Use the standard authenticated REST/CSRF behavior and Celery's returned task ID; do not add a separate task identifier or result store.

## Acceptance Criteria
- [x] A staff-only POST endpoint queues the sync task and returns HTTP 202 with its Celery ID and pending status.
- [x] Non-staff requests are denied and an unconfigured or unusable Fireplan session returns a useful API error without queueing the task.
- [x] Backend API tests cover staff authorization, session/configuration errors, task queuing, response shape, and task-detail report access.
- [x] The route is included in the API schema and documented in the backend URL/API inventory.

## Notes
- Added `POST /api/fireplan/sync-pagers/`, verified decryptability of configured password/cookies, and return the existing Celery task ID.
- Expanded the existing task list/detail query to expose Fireplan sync results through django-celery-results; no new task-result storage was added.
- Malformed encrypted cookie jars return a useful 400 before enqueueing. The full Fireplan suite plus Fireplan task-detail test pass (26 tests).
