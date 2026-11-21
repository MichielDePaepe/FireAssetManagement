---
task: 21.3
title: Add Celery tasks and hourly inventory synchronization
status: done
blocked-by: [21.2]
---
## Goal
Expose the inventory processing through the existing Celery task and reporting path, with a safe hourly summary scan and a forced period mode for phase 22 to call.

## Context
Reuse Celery, the task's existing ID, `celery-progress`, `django-celery-results`, and SSE task details. Do not add another task framework, result model, queue, or event bus. Scheduled runs must not retain unnecessary task results. Manual period requests always refetch details; the UI/API that initiates them belongs to phase 22. Because `updatedAt` is unconfirmed, the hourly run may process new inventories and mapping-version mismatches, but must not refetch every inventory detail tree.

## Acceptance Criteria
- [x] Tests first cover task arguments, task ID/progress reporting, result summary, and schedule options.
- [x] A registered Celery task calls the phase 21 processing service and accepts optional inclusive start/end dates for forced period processing.
- [x] Celery Beat schedules the automatic inventory task hourly with result storage disabled for scheduled invocations.
- [x] Manual invocations keep the normal task ID/result behavior and return a concise added/updated/skipped/failed report with per-inventory errors.
- [x] The task is added to the existing task list/detail allowlist so its existing SSE progress and result interface can display it.
- [x] Global credential/network failures use existing task failure/retry behavior; individual inventory failures remain in the report and do not erase prior successful data.
- [x] Tests confirm the hourly path does not fetch detail trees for every existing inventory and scheduled task results are not persisted.
- [x] Relevant Celery/API tests and Python lint pass, or service limitations are documented.

## Notes
- Added `fireplan.sync_inventories` with Celery retry/worker settings shared by the existing task system, progress recording, refreshed encrypted session storage, and per-inventory counts/errors.
- A manual start/end pair validates strict `YYYY-MM-DD` values and forces detail refetch; a scheduled call uses selective processing. Celery Beat runs hourly with `ignore_result` for that scheduled invocation; normal manual results remain enabled.
- Added the task to the existing task list/detail allowlist. Task and API tests passed (5); Django system check and Ruff passed.
