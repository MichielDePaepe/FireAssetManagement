---
title: Printer actions in the management page
status: done
blocked-by: [01, 02]
---
## Goal
Add connection-check and test-label actions to each configured printer in the staff-only label-printer management page.

## Context
Keep both actions on the existing `/labelprinters` page. Show independent loading, success, and error states and explain that reachability does not prove physical printer readiness. Update `README.md`, `SPEC.md`, and `ARCHITECTURE.md` to match the implemented behavior and its limits.

## Acceptance Criteria
- [x] Each printer row offers separate connection-check and test-label actions.
- [x] Each action has an accessible loading state and clear success/error feedback.
- [x] Frontend tests cover both actions, success and failure, and prevent duplicate submission while busy.
- [x] README, SPEC, and ARCHITECTURE accurately describe the network check, test label, dependency, and manual hardware-check limitation.

## Notes

Added typed API methods and independent action states to the staff label-printer page, including TCP-only and physical-print caveats.
Updated README, SPEC, and ARCHITECTURE and documented the still-pending manual proof print.
Verification: focused printer page tests, 15 passed; full frontend suite, 29 passed and 2 unrelated Fireplan/Pagers toast tests failed; ESLint and TypeScript passed.
Full backend suite: 44 passed and 2 unrelated pager/Celery tests failed; `ruff check printers` passed, repo-wide Ruff still reports the existing two Fireplan import-order issues.
