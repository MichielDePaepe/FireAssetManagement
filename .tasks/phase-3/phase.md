---
phase: 3
title: Fireplan pager sync backend
status: pending
opened: ~
closed: ~
---
## Goal
Store Fireplan IDs and QR URLs on pager records and synchronize matching Fireplan inventory through a Celery task using the existing Fireplan session and task-result infrastructure.

## Exit Criteria
- Fireplan ID and QR URL are optional pager fields; a non-null Fireplan ID is unique.
- The Fireplan client reads `fr/api/inventory/qr-codes` through the existing encrypted session and same-origin client.
- Only records whose Fireplan `name` matches a configured `PagerType` are candidates; request up to 500 rows and follow `total` for additional pages.
- First-time linking uses exact serial number; subsequent runs prefer the stored Fireplan ID.
- Matching records are created or updated, local-only pagers are retained, and unknown Fireplan models are ignored.
- The Celery task reports progress and returns counts for added, updated, unchanged, and per-record errors through the existing result backend.

## Tasks
