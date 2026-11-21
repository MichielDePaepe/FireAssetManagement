---
id: task-02
title: Sync-knop en afrondende documentatie
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Start vanaf de detailpagina een gerichte synchronisatie, volg de bestaande taakvoortgang en documenteer en verifieer de volledige functie.

## Context
De lokale detailpagina staat in `frontend/src/pages/FireplanInventoryDetailPage.tsx`; hergebruik de taakdetailroute en SSE-flow. Werk ook `SPEC.md`, `ARCHITECTURE.md` en `README.md` bij volgens de repositorydocumentatie.

## Acceptance Criteria
- [x] De detailpagina heeft een sync-knop die alleen deze UUID verstuurt en daarna de bestaande taakvoortgangspagina opent.
- [x] Frontendtests dekken het starten, laden, foutstatus en doorgaan naar de taakdetailpagina.
- [x] `SPEC.md`, `ARCHITECTURE.md` en `README.md` beschrijven de lokale detailsnapshot, vectorbron per sync-status en gerichte hersynchronisatie.
- [x] Volledige backendtests, Vitest, Python-lint, ESLint en TypeScript-controles zijn uitgevoerd; de live Redis-test is uitgevoerd als de broker beschikbaar is, anders wordt de beperking genoteerd.

## Notes
- Added the accessible single-inventory sync button and API call; successful queueing stores the task ID and opens the existing task detail/SSE page, while queue errors remain visible.
- Updated `SPEC.md`, `ARCHITECTURE.md`, and `README.md` for the snapshot route, vector source, targeted task, and failure retention.
- Final checks: backend pytest 205 passed, 1 skipped; frontend Vitest 94 passed; Ruff, ESLint, and TypeScript passed.
- The skipped test requires a live Redis broker; it was not run because the test broker was unavailable.
