---
id: task-02
title: Sync-knop en afrondende documentatie
status: pending
complexity: medium
blocked-by: task-01
---
## Goal
Start vanaf de detailpagina een gerichte synchronisatie, volg de bestaande taakvoortgang en documenteer en verifieer de volledige functie.

## Context
De lokale detailpagina staat in `frontend/src/pages/FireplanInventoryDetailPage.tsx`; hergebruik de taakdetailroute en SSE-flow. Werk ook `SPEC.md`, `ARCHITECTURE.md` en `README.md` bij volgens de repositorydocumentatie.

## Acceptance Criteria
- [ ] De detailpagina heeft een sync-knop die alleen deze UUID verstuurt en daarna de bestaande taakvoortgangspagina opent.
- [ ] Frontendtests dekken het starten, laden, foutstatus en doorgaan naar de taakdetailpagina.
- [ ] `SPEC.md`, `ARCHITECTURE.md` en `README.md` beschrijven de lokale detailsnapshot, vectorbron per sync-status en gerichte hersynchronisatie.
- [ ] Volledige backendtests, Vitest, Python-lint, ESLint en TypeScript-controles zijn uitgevoerd; de live Redis-test is uitgevoerd als de broker beschikbaar is, anders wordt de beperking genoteerd.

## Notes
