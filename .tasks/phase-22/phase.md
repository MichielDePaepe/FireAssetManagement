---
phase: 22
title: Beheerinterface
status: pending
opened: ~
closed: ~
---
## Goal
Voeg een beheerpagina toe die FirePlan-inventarissen en hun lokale synchronisatiestatus toont en hersynchronisatie over een datumbereik kan starten.

## Carry from phase 21
1. Build the staff API over paginated FirePlan summaries plus local `FireplanInventory` status without fetching details for the list. Start `fireplan.sync_inventories` with inclusive `YYYY-MM-DD` start/end values for manual periods and track its Celery task ID through the existing task detail/SSE flow.

## Open follow-ups from phase 21
- `updatedAt` semantics for edits to closed inventories remain unconfirmed. Preserve the hourly no-full-detail-scan limitation in UI/API wording; manual period reprocessing remains the supported way to refresh existing details.

## Exit Criteria
- De pagina toont gepagineerde FirePlan-samenvattingen, inclusief inventarissen die nog niet in FAM zijn opgeslagen, zonder inventarisdetails op te halen.
- Per inventaris zijn synchronisatiestatus, laatste synchronisatiedatum en eventuele fout zichtbaar.
- Begindatum en einddatum starten een inclusieve periodeopdracht, ook voor reeds verwerkte inventarissen.
- De beheerder kan taakvoortgang en eindrapport openen via de bestaande taakinterface.
- De pagina bevat geen volledige inventarisboomviewer of mappingeditor.

## Tasks
