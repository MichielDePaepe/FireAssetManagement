---
phase: 35
title: Radio-assets koppelen aan FirePlan-inventarissen
status: closed
opened: 2026-11-23
closed: 2026-11-23
---
## Goal
Koppel radio-waarnemingen uit opgeslagen FirePlan-inventarissen aan FAM-radios en toon de historische relatie vanuit inventaris- en radiodetails.

## Carry from phase 34
- none

## Open follow-ups from phase 34
- The optional Redis-gated Celery/SSE integration test remains unverified; it was skipped in the full backend run after previously failing to terminate.

## Exit Criteria
- Elke FirePlan-inventaris kan meerdere toestelwaarnemingen bevatten; elke waarneming bewaart de oorspronkelijke FirePlan-serienummertekst en item-ID en kan optioneel naar een radio of pager verwijzen, nooit beide tegelijk.
- Radio-matching gebruikt genormaliseerde 14- en 15-cijferige TEI's, bewaart de bronwaarde en laat niet-gematchte items synchroniseren.
- Een datamigratie koppelt bestaande lokaal opgeslagen waarnemingen; succesvolle synchronisaties vernieuwen koppelingen en mislukte synchronisaties behouden de vorige snapshot.
- Inventaris- en radiodetailpagina's tonen de waarnemingen en historische links met beschikbare inventaris-, voertuig- en vectorinformatie.
- Tests dekken migratie, TEI-matching, meerdere en niet-gematchte items, beide detailweergaven en behoud na synchronisatiefout.
- README, SPEC en ARCHITECTURE zijn actueel waar nodig; vereiste backend-, frontend-, lint- en TypeScript-checks zijn gerapporteerd.
- Geen nieuwe dependencies of configuratievariabelen.

## Tasks
- [x] task-01-observation-links-and-matching.md
- [x] task-02-inventory-and-radio-detail-views.md
- [x] task-03-regressions-documentation-and-checks.md

## Carry-forward

### Carry from phase 35
- none

### Open follow-ups from phase 35
- The optional Redis-gated Celery/SSE integration test remains unverified; the full backend suite skipped it because no live broker was enabled, and an earlier forced run did not terminate.
