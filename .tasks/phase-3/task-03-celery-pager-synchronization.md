---
id: task-03
title: Synchronize pagers in Celery
status: done
complexity: high
blocked-by: task-01, task-02
---
## Goal
Implement an idempotent Fireplan pager synchronization service and Celery task that creates or updates pager records and returns a persisted summary with progress.

## Context
Phase 3 spec: `.tasks/specs/2026-11-14-fireplan-pager-synchronization.md`. Match records to configured `PagerType` names exactly. On first linking, match a local pager by exact serial number; on later runs, prefer Fireplan ID so a serial change updates the linked pager. Fireplan is authoritative for type, serial number, and QR URL. Preserve local-only pagers and ignore unknown Fireplan models. Fireplan serial numbers are mandatory; report malformed rows as errors and continue with valid rows. Reuse the Celery task ID, `celery-progress`, and `django-celery-results`; add no second task framework or result model. The phase 2 carry-forward requires keeping this independent of printer hardware and label printing.

## Acceptance Criteria
- [x] A registered Celery task fetches matching models and reports persisted progress through `ProgressRecorder`.
- [x] Matching records are created or updated by the specified Fireplan-ID/serial-number rules without deleting local-only pagers.
- [x] Unknown model names are ignored; invalid or conflicting rows are counted as errors while valid rows continue.
- [x] The successful result includes added, updated, unchanged counts and concise per-record error details.
- [x] Backend tests cover first import, repeat sync, Fireplan-ID match after serial change, local-only preservation, unknown models, malformed/conflicting rows, and task result/progress behavior.

## Notes
- Added an idempotent synchronization service and `fireplan.sync_pagers` Celery task using the configured credential, encrypted cookie jar, existing progress recorder, and Django result backend.
- The final Fireplan suite plus the task-detail integration test passes (26 tests); Ruff passes on every changed backend file. Including the untouched `fireplan/tests/test_api.py` in Ruff reports its pre-existing import-order issue.
