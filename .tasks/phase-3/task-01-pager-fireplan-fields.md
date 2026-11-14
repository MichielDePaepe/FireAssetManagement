---
id: task-01
title: Store Fireplan pager identifiers
status: done
complexity: low
blocked-by: ~
---
## Goal
Add optional, unique Fireplan identity and QR URL fields to pager records and expose them in the pager API as read-only synchronization metadata.

## Context
Phase 3 spec: `.tasks/specs/2026-11-14-fireplan-pager-synchronization.md`. Existing pagers have a unique serial number and a `PagerType`. Fireplan returns a numeric `id` and complete `qrCode` URL. Locally entered pagers must continue working with these fields empty until synchronized.

## Acceptance Criteria
- [x] A nullable unique Fireplan ID and nullable QR URL are added to `Pager` with a migration.
- [x] The pager API returns both fields and does not allow clients to write them.
- [x] Existing pager creation and editing continue to accept only serial number and type.
- [x] Backend tests cover empty metadata, returned values, and read-only behavior.

## Notes
- Added `fireplan_id` and `fireplan_qr_url` with migration `0003` and read-only serializer fields.
- Three focused metadata tests pass, including unique non-null IDs.
- The full pager API test file retains one pre-existing type-order assertion failure (`test_pager_can_be_created_and_edited`); no unrelated test changes made.
