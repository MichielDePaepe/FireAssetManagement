---
task: 22.2
title: Add FirePlan inventory management page
status: done
blocked-by: [22.1]
---
## Goal
Add the staff-facing FirePlan inventory page with server-side pagination, synchronization status, and a validated action to reprocess an inclusive date range.

## Context
Reuse the API from task 22.1 and the existing Celery task detail/SSE page. The inventory list must remain summary-only. The user starts a period task and can open its progress and final report through the existing task interface. Preserve the documented limitation that `updatedAt` is not proven to signal edits to closed inventories. Do not add a full inventory tree viewer or YAML editor.

## Acceptance Criteria
- [x] Frontend tests first cover loading, empty, API error, unsynchronized rows, pagination, date validation, and task navigation.
- [x] A lazy-loaded staff-only route and **Beheer** navigation link open the inventory management page.
- [x] The page presents paginated source summaries, including unsynced FirePlan rows, with sync status, last successful time, and per-record error.
- [x] The page uses accessible labels and states, square corners, and the shared table header/cell treatment.
- [x] Required start/end date inputs reject missing or reversed dates; a valid action submits the inclusive date period and navigates to the returned task's existing detail page.
- [x] The existing task detail view recognizes `fireplan.sync_inventories` and displays added, updated, skipped, failed, and per-inventory errors from the saved result.
- [x] The page explains that manual period processing refreshes existing details; it does not claim that hourly `updatedAt` detection finds every closed-inventory edit.
- [x] Frontend Vitest, ESLint, and TypeScript checks pass, or environment limitations are recorded.

## Notes
- Added the accessible, paginated management page, staff route/navigation, and inclusive period action in `frontend/src/pages/FireplanInventoriesPage.tsx`, `frontend/src/main.tsx`, and `frontend/src/components/AppLayout.tsx`.
- Extended saved task results with inventory counts and per-inventory errors in `frontend/src/components/TaskProgress.tsx`; existing pager reports remain supported.
- Frontend suite: 89 passed; ESLint and TypeScript passed. Backend: 195 passed, one live-Redis test skipped; Ruff and Django system check passed.
