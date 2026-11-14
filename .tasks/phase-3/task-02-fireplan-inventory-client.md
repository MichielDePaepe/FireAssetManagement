---
id: task-02
title: Read Fireplan pager inventory
status: done
complexity: medium
blocked-by: ~
---
## Goal
Add a Fireplan client operation that retrieves every QR inventory record matching the pager model names supplied by the local database.

## Context
Phase 3 spec: `.tasks/specs/2026-11-14-fireplan-pager-synchronization.md`. Use the existing encrypted Fireplan credentials, saved session cookies, HTTPS origin validation, and standard-library HTTP client. The endpoint is `fr/api/inventory/qr-codes`; the response contains `records` and `total`. Fireplan accepts `first` and `rows=500`, plus a minimal `filters.name` object. Preserve `filterOptionsExcluded` to suppress the large unused option catalogue. Do not change printer integrations.

## Acceptance Criteria
- [x] The client fetches pages of up to 500 for an explicit list of exact model names and follows `total` until all matching records are read.
- [x] The request uses the existing authenticated Fireplan session and rejects redirects outside the configured HTTPS origin.
- [x] Response records retain Fireplan `id`, `name`, `serialNumber`, and the complete `qrCode` URL; malformed responses raise a clear integration error.
- [x] Backend tests cover request filters/pagination, successful parsing, session/cookie handling, and Fireplan HTTP or response failures.

## Notes
- Added authenticated, same-origin QR inventory fetching with compact filters and 500-row pagination; refreshed cookies are returned for persistence by the caller.
- All 13 Fireplan backend tests pass; Ruff passes on changed backend files; `makemigrations --check` reports no changes.
