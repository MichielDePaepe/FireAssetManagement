---
phase: 3
title: Fireplan pager sync backend
status: pending
opened: ~
closed: ~
---
## Goal
Store Fireplan IDs and QR URLs on pager records and synchronize matching Fireplan inventory through a Celery task using the existing Fireplan session and task-result infrastructure.

## Carry from phase 2
1. No printer-module changes are required for this phase; keep Fireplan inventory synchronization separate from physical label printing.

## Open follow-ups from phase 2
- A manual proof print on the deployed Brother PT-P900W remains pending. Mocked tests do not verify physical compatibility; record the printer, tape width, date, and result in `docs/label-printer-dependencies.md` when performed.

## Exit Criteria
- Fireplan ID and QR URL are optional pager fields; a non-null Fireplan ID is unique.
- The Fireplan client reads `fr/api/inventory/qr-codes` through the existing encrypted session and same-origin client.
- Only records whose Fireplan `name` matches a configured `PagerType` are candidates; request up to 500 rows and follow `total` for additional pages.
- First-time linking uses exact serial number; subsequent runs prefer the stored Fireplan ID.
- Matching records are created or updated, local-only pagers are retained, and unknown Fireplan models are ignored.
- The Celery task reports progress and returns counts for added, updated, unchanged, and per-record errors through the existing result backend.

## Tasks
