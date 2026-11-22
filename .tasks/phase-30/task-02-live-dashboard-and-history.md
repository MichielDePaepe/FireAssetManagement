---
id: task-02
title: Live dashboard en statusgeschiedenis
status: done
complexity: high
blocked-by: task-01
---
## Goal
Vervang de generieke Dashboard-pagina door het goedgekeurde postenoverzicht met live CityGIS-data, compacte vectorstatussen, uitklapbare cellen en statusgeschiedenis.

## Context
Gebruik `api.listLocations()`, `api.getCityGIS()`, `subscribeToCityGIS()` en `CityGISStatusHistoryDialog`. Behoud bestaande taskpagina's. De goedgekeurde visuele referentie is een standalone bestand buiten de app; lever dat bestand niet mee in de applicatie. Zie de extension spec voor inhoudelijke regels en niet-doelen.

## Acceptance Criteria
- [x] Dashboard haalt posten en initiële CityGIS-snapshot op; SSE-updates verversen gegevens en een verbroken verbinding laat de laatste snapshot staan met een zichtbare verbindingsstaat.
- [x] Elke post krijgt kolommen voor Post, APM, AE, AMB, Rest en Status 90+, dynamische totalen `beschikbaar/totaal`, en maximaal drie zichtbare rijen per cel met toegankelijke uitklapbediening.
- [x] Vectoren tonen links een rechthoekige verticale kleurstreep van 6 px zonder zichtbaar nummer; statuscode en omschrijving staan in de toegankelijke naam en tooltip. Voertuigcode en gedempte vectorcode staan ernaast zonder afkapping; onbekende status gebruikt een neutrale streep en `?` in de toegankelijke tekst.
- [x] Statusknop opent de bestaande CityGIS-historiek voor de juiste vector.
- [x] De pagina heeft toegankelijke laad-, lege, permissie- en fouttoestanden, past in de bestaande vierkante componentstijl en behoudt horizontale bruikbaarheid op smalle schermen.
- [x] Tests zijn test-first geschreven voor data laden, groepering tonen, uitklappen en statusgeschiedenis; implementatie slaagt voor de gerichte tests en typecheck.

## Notes
- Replaced `DashboardPage.tsx` with the live post overview, fixed-layout table, status controls, per-cell expansion, connection state, retry and history dialog.
- Added `DashboardPage.test.tsx` with four test-first scenarios; targeted Vitest and TypeScript checks pass.
- User refinement after phase 30: Rest uses three columns, other asset groups two; no internal vector dividers, post sort names, or hyphens in empty cells. These refinements were implemented and verified in phase 31.
- Post-close wording refinement: expansion controls now say only `Toon N extra` / `Minder tonen`, without repeating the post name; the dashboard component test checks both labels.
- No backend, API, model, migration, dependency or sync changes were needed.
