---
phase: 34
title: Verificatie en documentatie
status: closed
opened: 2026-11-23
closed: 2026-11-23
---
## Goal
Dek de nieuwe postnavigatie, gegevenscombinatie en statusberekeningen af en houd de productdocumentatie actueel.

## Exit Criteria
- Backendtests dekken posttoegang, actieve pager- en radiokoppelingen, statusperioden aan venstergrenzen, ontbrekende historie, bron- en waarnemingstijden, en percentages.
- Frontendtests dekken postnavigatie, vector- en assetweergave, alle typegroepen, tooltips/toetsenbordtoegang, vier percentages, onbekende perioden, laad-, fout- en lege toestanden en live updates.
- De vereiste backend- en frontendchecks, linting en TypeScript-controles zijn uitgevoerd waar de lokale services beschikbaar zijn; niet-uitgevoerde checks worden met reden gerapporteerd.
- README.md en SPEC.md beschrijven de postdashboardfunctie correct; ARCHITECTURE.md wordt alleen bijgewerkt als de feitelijke gegevensstroom wijzigt.
- Er zijn geen nieuwe dependencies, tabellen of deploymentwijzigingen.

## Carry from phase 33
1. The shareable route is `/posts/:postId`; the page loads the combined overview and uses the existing CityGIS SSE stream, refreshing the complete overview when that stream changes.
2. `postDashboardStatus.ts` groups types and computes whole-window rounded percentages; status segments are keyboard-focusable buttons with status, duration, and start/end details.
3. Focused UI and helper tests passed for route details, assets, live updates, period tooltip, percentages, and other-type expansion.

## Open follow-ups from phase 33
- Phase 31's optional Redis-gated Celery/SSE integration test previously failed to terminate and was stopped; do not treat it as verified by the regular suite.

## Tasks
- [x] task-01-regression-documentation-and-full-checks.md

## Carry-forward

### Carry from phase 34
- none

### Open follow-ups from phase 34
- The optional Redis-gated Celery/SSE integration test remains unverified; it was skipped in the full backend run after previously failing to terminate.
