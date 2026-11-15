---
phase: 5
title: CityGIS domain and source synchronization
status: closed
opened: 2026-11-14
closed: 2026-11-14
---
## Goal
Rework the unverified CityGIS prototype into tested domain models, source clients, status catalog, and safe synchronization for Fireplan vehicles and individual resources-service vector records.

## Exit Criteria
- Physical Fireplan vehicles, dispatch vectors, and vector status definitions are stored as separate records.
- Fireplan's active vehicle list and the authenticated resources service are fetched using the configured Fireplan credentials; secrets remain encrypted and are never returned to the browser.
- Each vector record preserves its own source identifiers, raw string status code, `LastStatusTimeUpdated` timestamp, and source vehicle name; `ResourceCode` and `pResourceCode` remain distinct.
- The status migration imports all 17 rows from the supplied image using only code, description, abbreviation, and color; other image columns are excluded.
- Vehicle linking compares vector `Name` with Fireplan `alphacode`. An unmatched vector remains unlinked. When multiple vector records match one vehicle, the first record in source order is linked and each duplicate match is recorded as an error in structured logs.
- A source failure prevents partial synchronization. After a complete successful sync, records missing from their respective source are retained and marked as no longer reported; a later reappearance marks them current again.
- Tests cover source payload parsing, timestamps, status values, matching, duplicate logging, missing-record marking, and failed/incomplete fetch behavior.

## Tasks
- [x] task-01-citygis-domain-models-and-catalog.md
- [x] task-02-citygis-source-clients.md
- [x] task-03-citygis-safe-reconciliation.md
