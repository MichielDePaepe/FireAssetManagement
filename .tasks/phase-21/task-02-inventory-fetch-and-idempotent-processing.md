---
task: 21.2
title: Fetch and process FirePlan inventories idempotently
status: done
blocked-by: [21.1]
---
## Goal
Fetch paginated FirePlan inventory summaries and only the inventory details that need processing, then update stored records safely and idempotently.

## Context
Reuse the authenticated Fireplan HTTPS client/session and phase 20 mapping and aware datetime parser. Resolve the exact `Cabine de conduite` UUID from each inventory tree before calling the item endpoint. The live API's `updatedAt` behavior on closed inventory edits is unconfirmed: do not use it as a proven change detector or download all details hourly. Fetch details for new inventories, mapping-version mismatches, and every inventory in a forced manual date period. Keep source summary metadata current without replacing successful details.

## Acceptance Criteria
- [x] Client tests first cover summary pagination, field validation, dynamic container-tree lookup, and filtered radio item retrieval without logging secrets or identifiers.
- [x] Summary pagination supports a closed-date period using inclusive Europe/Brussels local dates; if date filters are unsupported, safely scan descending pages and stop before the start date.
- [x] The processing service ingests new inventories, skips detail retrieval for already processed unchanged-mapping records, and retrieves details for a mapping-version mismatch.
- [x] A successful detail fetch and validation update selected-radio JSON and replace observation rows atomically; repeat processing creates no duplicates.
- [x] A detail or validation failure records status/error while preserving the last successful JSON and observations.
- [x] Forced processing always retrieves details again for every inventory in the inclusive period and recalculates the historical vehicle/vector link.
- [x] Tests cover new versus existing fetch decisions, map version changes, successful replacement, failure preservation, and inclusive date boundaries.
- [x] Relevant backend tests and lint pass, or unavailable environment limitations are recorded.

## Notes
- Added `FireplanInventoryClient` for authenticated, paginated closed-inventory summaries and inventory-specific tree/item requests through the existing HTTPS/session helpers.
- Source summaries are sorted/validated and filtered by inclusive Brussels dates. Since date filters were not verified, the client scans descending pages and stops before the start date.
- Added selective processing: periodic callers can pass summaries to process new, failed, or mapping-version-mismatched records without treating `updatedAt` as a detail-change signal; forced periods always refetch details.
- Successful selected-radio JSON and observation replacement occur in one transaction. Failure status/error updates preserve prior successful data; exact vehicle and time-valid vector links are recalculated from each summary.
- Client, storage, synchronization, and CityGIS relationship tests passed (19 in the combined run; 6 synchronization tests passed again after adding the forced relationship-recalculation regression). Ruff and migration drift checks passed.
