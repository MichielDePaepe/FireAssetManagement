---
phase: 4
title: Sync controls, progress, and report
status: open
opened: 2026-11-14
closed: ~
---
## Goal
Let staff start the Fireplan sync from the pager page, navigate while it runs, and view its persisted progress and final report through the existing task UI.

## Carry from phase 3
1. Start the task with `POST /api/fireplan/sync-pagers/`; it returns `{task_id, status: "PENDING"}` and is restricted to staff.
2. The registered Celery task name is `fireplan.sync_pagers`. Existing task list/detail APIs now include this task name and return the Django result-backend report with `added`, `updated`, `unchanged`, and `errors` fields.
3. Pager synchronization only imports exact model names configured in `PagerType`; it stores Fireplan ID and the full QR URL, preserves local-only pagers, and does not print labels.
4. Toaster placement is still part of phase 4: every toast must appear at the bottom right. Keep visual corners square and use existing task progress/result infrastructure.

## Open follow-ups from phase 3
- Live synchronization against the configured Fireplan account was not run. Confirm it in the target environment and review the persisted report after deployment.
- The full repository test run has existing unrelated failures: the pager API type-order assertion, a Celery integration test that references the `client` fixture without requesting it, and two frontend toast-message assertions. Frontend ESLint and TypeScript checks pass; record whether those failures remain when phase 4 is verified.

## Exit Criteria
- Only staff can enqueue a pager synchronization.
- The existing task collection and detail views recognize and label Fireplan sync tasks.
- Users can navigate away while the task runs and reopen its progress and result later.
- Completion shows a bottom-right toast with a report action; the action opens an accessible square-corner modal.
- The report shows added, updated, unchanged, and failed records; completed task details keep the report available.
- Global toasts appear at the bottom right.
- README, ARCHITECTURE.md, and SPEC.md describe the integration and its limits.

## Tasks
- [ ] task-01-pager-sync-control.md
- [ ] task-02-sync-progress-and-report.md
- [ ] task-03-bottom-right-toasts.md
