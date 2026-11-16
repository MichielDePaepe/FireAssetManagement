---
phase: 16
title: Pager scanlookup
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Add an authenticated backend lookup that normalizes keyboard-scanner layout variants and matches the complete scanned Fireplan QR URL to a stored pager URL.

## Carry from phase 15
- none

## Open follow-ups from phase 15
- Rerun `makemigrations --check --dry-run` and `manage.py check` with Docker socket access.
- Recheck the authenticated `/locations` page visually when browser access is available.

## Exit Criteria
- The lookup preserves the raw scan and tries the documented AZERTY/QWERTY variants as alternatives.
- A pager is resolved only by matching its complete stored Fireplan QR URL; the Fireplan ID is not extracted for this lookup.
- Unknown or invalid scans return a clear error response.

## Tasks
- [x] task-01-authenticated-pager-scanlookup.md

## Execution Notes
- Completed authenticated full-URL lookup with documented keyboard layout candidates. Backend task suite: 9 passed.

## Carry-forward

### Carry from phase 16
- none

### Open follow-ups from phase 16
- Location migration/system checks and authenticated `/locations` visual recheck carried from phase 15 remain outstanding.
