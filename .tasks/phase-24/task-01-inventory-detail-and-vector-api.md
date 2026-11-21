---
id: task-01
title: Lokale detail-API en vectorkolomdata
status: done
complexity: medium
blocked-by: ~
---
## Goal
Lever lokale detailgegevens voor gesynchroniseerde inventarissen en de juiste vector voor alle inventarisrijen.

## Context
De FirePlan-inventarislijst staat in `backend/fireplan/views.py`. `FireplanInventory` bewaart de laatste succesvolle snapshot, relaties en `radio_items`; radio-observaties staan in `FireplanRadioObservation`. `resolve_inventory_relationship` gebruikt de bestaande voertuig- en `VectorVehicleHistory`-gegevens.

## Acceptance Criteria
- [x] De staff-only detail-API leest één lokale inventaris op UUID, inclusief voertuig, vector, radio-observaties, metadata, synchronisatiestatus/fout en opgeslagen JSON; zij vraagt FirePlan niet op.
- [x] Een inventaris zonder `last_successful_sync_at` heeft geen beschikbare detailresponse; een eerdere succesvolle snapshot blijft leesbaar na een mislukte poging.
- [x] De lijstresponse bevat de vector: gebruik de opgeslagen relatie als er ooit succesvol gesynchroniseerd is; bereken anders op basis van voertuigcode, FirePlan-inventaristijdstip en `VectorVehicleHistory`.
- [x] Zonder eenduidige voertuigkoppeling of historische vector blijft de vector onbekend.
- [x] Backendtests dekken staff-toegang, lokale detailinhoud, nooit-gesynchroniseerde records, mislukte latere poging en beide vectorpaden.

## Notes
- Added `FireplanInventoryDetailView` and a named UUID route; only locally stored snapshots with a successful sync are returned.
- Added vector code/name to inventory summaries, preferring stored links after successful sync and resolving history for unsynced rows.
- Updated `backend/fireplan/views.py`, `backend/fireplan/urls.py`, and `backend/fireplan/tests/test_inventory_management_api.py`.
- Verification: `pytest fireplan/tests/test_inventory_management_api.py -q` — 9 passed in Docker Compose dev environment.
- Updated two stale FirePlan-client test expectations to match the existing `multiSortMeta` request and full pagination when source ordering is not guaranteed.
