---
id: task-03
title: Move global toasts to bottom right
status: done
complexity: low
blocked-by: ~
---
## Goal
Show all application toasts at the bottom right, including the Fireplan completion toast.

## Context
The user explicitly requested a bottom-right toast position. Reuse the existing toast package and provider; do not add a dependency or another notification abstraction.

## Acceptance Criteria
- [x] Global toasts appear at the bottom right on desktop and remain reachable on narrow screens.
- [x] Fireplan completion toast action remains usable with keyboard and screen readers.
- [x] Existing and new toast tests pass, including success and error messages.

## Notes
- Moved the shared Sonner provider to bottom-right placement and set square corners for notifications and toast action buttons.
- The notification position/action test passes; all 45 frontend tests pass.
