---
phase: 34
task: 1
title: Postdashboardregressies, documentatie en controles
status: done
blocked-by: []
---
## Goal
Vul regressietests aan voor gegevens en UI van het postdashboard, werk README en SPEC bij en voer de beschikbare vereiste controles uit.

## Context
De postdetailroute combineert post-, vector-, voertuig- en fysieke assetgegevens met een 24-uurs statusvenster. De gewone backend suite slaat de optionele Redis-gegate integratietest over; die test stopte eerder niet tijdig en is niet geverifieerd.

## Acceptance Criteria
- [x] Backendtests dekken toegang, actieve pager/radiokoppelingen, statusvenstergrenzen, ontbrekende historie, bron-/waarnemingstijd en >50 statusperioden.
- [x] Frontendtests dekken navigatie, gegevens, vectorgroepen, AMBINC, toetsenbordtooltips, percentages, onbekende segmenten, laad-, fout-, lege en live-toestanden.
- [x] Backendpytest, frontend Vitest, Ruff, ESLint en TypeScript-controles zijn uitgevoerd waar lokale services beschikbaar zijn; niet-uitgevoerde controles hebben een reden.
- [x] README.md en SPEC.md beschrijven het postdashboard actueel; ARCHITECTURE.md verandert alleen als de feitelijke datastroom dat vereist.
- [x] Geen nieuwe dependencies, tabellen, migraties of deploymentwijzigingen.

## Notes
- Backend: 268 passed, 1 skipped (optional Redis-gated integration test; requires a live Redis broker and was previously stopped after hanging). Ruff passes.
- Frontend: 140 passed in 24 files; ESLint and TypeScript checks pass. `git diff --check` passes.
- Updated README, SPEC (FR-044), and the overview endpoint description in ARCHITECTURE. No migration, dependency, or deployment change.
- Browser visual inspection was unavailable because the browser access host reported unavailable; API and component rendering are covered by automated tests.
