---
phase: 18
task: 1
title: Inventory pager scan flow
status: done
blocked-by: []
---
## Goal
Connect pager scanning on the inventory pager list to the existing pager relationship-management dialog.

## Acceptance Criteria
- [x] A scanned registered pager opens its existing relationship dialog.
- [x] Invalid or unknown scans show an error toast without opening a dialog.
- [x] Frontend tests cover the success and error flows.

## Notes
- Added inventory-list scanning through the authenticated lookup; a match refreshes the snapshot and opens the existing pager relationship dialog.
- Unknown scans show an error toast. Inventory page tests cover both success and failure.
