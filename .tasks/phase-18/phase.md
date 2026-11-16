---
phase: 18
title: Pager scan flows
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Integrate scanning into the inventory pager list and the free-pager section of a vector's relationship dialog.

## Carry from phase 17
- none

## Open follow-ups from phase 17
- Location migration/system checks and authenticated `/locations` visual recheck carried from phase 15 remain outstanding.

## Exit Criteria
- Scanning a registered pager from the inventory pager list opens its existing relationship-management dialog.
- Scanning a pager that is currently free in a vector dialog links it to that vector and refreshes the lists.
- Invalid, unknown, or non-free pager scans show an error toast and do not alter another vector's relationship.

## Tasks
- [x] task-01-inventory-pager-scan-flow.md
- [x] task-02-free-pager-vector-scan-flow.md

## Execution Notes
- Inventory pager scanning opens the existing pager editor. Vector-dialog scans assign only free pagers and refresh the inventory snapshot. Targeted InventoryPage tests: 12 passed.

## Carry-forward

### Carry from phase 18
- none

### Open follow-ups from phase 18
- Location migration/system checks and authenticated `/locations` visual recheck carried from phase 15 remain outstanding.
