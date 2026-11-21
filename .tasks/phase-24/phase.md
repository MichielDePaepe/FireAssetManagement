---
phase: 24
title: Lokale inventarisdetailpagina
status: closed
opened: 2026-11-21
closed: 2026-11-21
---
## Goal
Laat beheerders de laatst succesvol gesynchroniseerde FirePlan-inventaris en radioresultaten lokaal bekijken, met de overeenkomstige vector in de inventarislijst.

## Carry from phase 23
1. None.

## Open follow-ups from phase 23
- The live Redis broker test was skipped in local verification; run it in an environment with the broker available.
- No live FirePlan synchronization was performed in this phase. The semantics of `updatedAt` for edits to already closed inventories remain unconfirmed; retain manual period reprocessing as the supported refresh path.

## Exit Criteria
- Een inventaris met een succesvolle synchronisatie opent vanuit Beheer → FirePlan-inventarissen een detailpagina die uitsluitend de lokaal opgeslagen snapshot toont.
- De detailpagina toont inventarismetadata, relaties, synchronisatiestatus, radio-observaties met TEI/item-ID en de bewaarde radio-JSON netjes geformatteerd.
- De overzichtstabel gebruikt voor gesynchroniseerde inventarissen de lokaal opgeslagen vectorkoppeling; voor niet-gesynchroniseerde inventarissen bepaalt zij de vector via `VectorVehicleHistory`, de voertuigcode en het FirePlan-inventaristijdstip. Zonder historische gegevens blijft de vector onbekend.
- Records zonder succesvolle synchronisatie zijn niet openbaar als detail; na een mislukte nieuwe poging blijft de laatste succesvolle snapshot zichtbaar met de foutstatus.

## Tasks
- [x] task-01-inventory-detail-and-vector-api.md
- [x] task-02-inventory-detail-page-and-vector-table.md
