---
task: 22.1
title: Add paginated FirePlan inventory management API
status: done
blocked-by: []
---
## Goal
Provide a staff-only paginated FirePlan inventory summary API merged with local synchronization status, plus a validated endpoint to start forced period processing.

## Context
Use the phase 21 `FireplanInventoryClient`, `FireplanInventory`, encrypted credentials, and `fireplan.sync_inventories` Celery task. The list must fetch summaries only and include FirePlan records not yet stored in FAM. `updatedAt` is not a proven content-change signal; do not initiate automatic detail retrieval from the list endpoint. Manual date periods are inclusive and must always refetch details in the Celery task.

## Acceptance Criteria
- [x] Tests first cover summary page retrieval, local status merge, admin access, date validation, and Celery task submission.
- [x] `GET /api/fireplan/inventories/` validates page and page size, requests only one FirePlan summary page, and returns the source count plus page metadata.
- [x] Each result includes source summary fields and local sync status, last successful time, and error; absent local records show `not_synced`.
- [x] The list endpoint never requests an inventory tree or item list and safely refreshes the encrypted FirePlan session when needed.
- [x] `POST /api/fireplan/sync-inventories/` requires both ISO start/end dates, rejects invalid or reversed periods, verifies stored credentials, and queues the task with those dates as strings.
- [x] Both endpoints follow the existing `IsAdminUser` pattern; invalid credentials/source failures return a safe API error without exposing secrets.
- [x] `ARCHITECTURE.md` includes the new routes and describes the summary-only list behavior.
- [x] Relevant backend/API tests, Django checks, and Python lint pass, or limitations are recorded.

## Notes
- Added `GET /api/fireplan/inventories/` with one-page source pagination merged with local `FireplanInventory` status; unmapped local rows show `not_synced`. The endpoint refreshes encrypted cookies and never requests details.
- Added `POST /api/fireplan/sync-inventories/` with strict ISO date validation and Celery task submission; invalid credentials and source failures use safe error messages.
- API/client tests passed (11); Django system check and Ruff passed. The current FirePlan pagination contract was reused; no live list response was required for these mocked endpoint tests.
