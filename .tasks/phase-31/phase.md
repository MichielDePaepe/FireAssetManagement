---
phase: 31
title: Dashboardverificatie en documentatie
status: closed
opened: 2026-11-22
closed: 2026-11-22
---
## Goal
Controleer het nieuwe dashboardgedrag, voer de beschikbare projectchecks uit en werk documentatie bij waar die het dashboard onjuist beschrijft.

## Carry from phase 30
1. Keep the grouping behavior in `frontend/src/lib/dashboardGrouping.ts`; the CityGIS API supplies the nested `vector.post` mapping used by the dashboard.
2. Extend behavior tests for two-digit and unknown status display, empty/error states, and post mapping; current focused tests cover core grouping, initial display, expansion, history click and SSE updates.

## Open follow-ups from phase 30
- Run full project verification and update dashboard documentation in phase 31.

## Exit Criteria
- Frontendtests dekken groepering, status- en typegrenzen, prioriteitsvolgorde, totalen, uitklappen, onbekende status en het openen van statusgeschiedenis.
- Frontendtests dekken laden, lege resultaten, fouten, SSE-updates en verouderde data bij een verbroken verbinding.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint en TypeScript-controles zijn uitgevoerd waar de vereiste services beschikbaar zijn; niet-uitgevoerde checks zijn met reden gerapporteerd.
- README en SPEC.md zijn bijgewerkt als hun dashboardbeschrijving niet meer klopt; ARCHITECTURE.md alleen als de feitelijke datastroom wijzigt.
- Er is geen migratie of deploymentwijziging nodig.

## Tasks
- [x] task-01-regression-documentation-and-checks.md

## Carry-forward

### Carry from phase 31
1. The dashboard continues to use the existing CityGIS snapshot/history API and SSE stream; the dashboard feature added no backend or deployment architecture.

### Open follow-ups from phase 31
- The optional Redis-gated Celery/SSE integration test did not terminate during its forced run and was stopped; the regular backend suite passed with that one test skipped.
