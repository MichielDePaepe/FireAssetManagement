---
phase: 18
task: 2
title: Free pager vector scan flow
status: done
blocked-by: []
---
## Goal
Connect pager scanning inside a vector relationship dialog to immediate linking of a free pager to that vector.

## Acceptance Criteria
- [x] A scanned pager currently free in the selected vector is linked to it and both lists refresh.
- [x] Invalid, unknown, or non-free scans show an error toast and do not change another vector's relationship.
- [x] Frontend tests cover successful linking and refusal of a pager assigned elsewhere.

## Notes
- Added scan handling to the vector relationship dialog; only unassigned pagers reach the existing save-and-refresh callback.
- Unknown scans and pagers linked to any vector show an error toast; tests confirm no reassignment request is sent.
