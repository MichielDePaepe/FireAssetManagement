---
task: 21.1
title: Add FirePlan inventory storage and historical vehicle-vector links
status: done
blocked-by: []
---
## Goal
Add the database records needed to store FirePlan inventory metadata, selected radio observations, synchronization state, and the vehicle/vector association at inventory time.

## Context
Use the Fireplan Django app, CityGIS `Vehicle` and `VectorVehicleHistory`, and the phase 20 YAML mapping/date parser. The FirePlan inventory UUID is the unique source key; item IDs are strings and TEI values must remain text. Preserve the original `vehicleAlphaCode`. The vector history interval is `observed_at <= closedAt < ended_at`, with a missing `ended_at` treated as open-ended. Keep a missing/ambiguous vehicle or missing history as an unknown link.

## Acceptance Criteria
- [x] Tests first cover inventory UUID uniqueness, inventory/item ID uniqueness, TEI text preservation, source metadata, and synchronization state fields.
- [x] A migration adds an inventory record with source vehicle code, type/location/operator/supervisor, created/closed/updated times, available status values, selected-radio JSON, mapping version, sync status, last success, and last error.
- [x] Structured radio observations store FirePlan item ID and TEI as text and have a unique constraint on inventory plus item ID.
- [x] A resolver links `vehicleAlphaCode` only when it exactly matches one FAM vehicle; it stores that vehicle/FirePlan ID and retains the original code.
- [x] The resolver finds the vector whose `VectorVehicleHistory` interval contains the aware `closedAt` value, using `observed_at` and `ended_at`; missing/ambiguous vehicles and missing history leave the link unknown.
- [x] Tests cover exact and ambiguous vehicle matches, interval start/end boundaries, and absent history.
- [x] Migration checks and relevant model/history tests pass, or limitations are documented.

## Notes
- Added `FireplanInventory` and `FireplanRadioObservation`, including source metadata, selected-radio JSON, sync state, and database uniqueness constraints; migration `0002` was generated.
- `resolve_inventory_relationship` uses an exact unique alphacode match and the half-open observed history interval; it retains a unique vehicle match even if no vector history exists.
- Seven new tests passed; migration drift check and Django system check passed; related CityGIS history tests passed; Ruff passed.
