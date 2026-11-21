---
id: task-02
title: Inventarisdetailpagina en vectorkolom
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Toon de vector bij elke inventaris in de lijst en laat beheerders de lokale snapshot van een gesynchroniseerde inventaris openen.

## Context
De overzichtspagina is `frontend/src/pages/FireplanInventoriesPage.tsx`; routes staan in `frontend/src/main.tsx` en API-types en calls in `frontend/src/lib/api.ts`. Volg de bestaande square-corner- en tabelpatronen.

## Acceptance Criteria
- [x] De lijst toont een vectorkolom met API-data; gesynchroniseerde inventarissen gebruiken de opgeslagen vector en niet-gesynchroniseerde de historische vector. Onbekend wordt expliciet weergegeven.
- [x] Alleen inventarissen met een succesvolle synchronisatie zijn klikbaar en openen een detailroute; de pagina laadt de lokale detail-API.
- [x] De detailpagina toont de opgeslagen metadata en relaties, synchronisatiestatus/fout, radio-observaties met TEI/item-ID en `radio_items` als leesbare pretty-printed JSON.
- [x] Laden, API-fout, onbekende relaties en lege observaties hebben toegankelijke UI-statussen.
- [x] Frontendtests dekken de vectorkolom, klikbaarheid, detailinhoud en foutstatus.

## Notes
- Added the inventory detail route and local snapshot page with metadata, relationship, sync-error, radio-observation, and formatted JSON sections.
- Added the vector column and links only for inventories with a successful sync.
- Updated `frontend/src/lib/api.ts`, `frontend/src/main.tsx`, `frontend/src/pages/FireplanInventoriesPage.tsx`, `frontend/src/pages/FireplanInventoriesPage.test.tsx`; added `frontend/src/pages/FireplanInventoryDetailPage.tsx`.
- Verification: focused Vitest file — 7 passed; `npm run lint` and `npm run typecheck` passed.
