---
phase: 33
title: Postdashboardinterface
status: closed
opened: 2026-11-23
closed: 2026-11-23
---
## Goal
Maak posten vanuit het overzicht aanklikbaar en toon per post een dashboard met vectoren, gekoppelde voertuigen en assets, en 24-uurs statusbalken.

## Exit Criteria
- Elke post opent een eigen deelbare route met terugnavigatie naar het postenoverzicht en toont de post zelf als locatie.
- Per vector zijn de vectorcode, actuele CityGIS-status, bijbehorend voertuig en beschikbare voertuigstatusvelden, plus gekoppelde pagers en radio's zichtbaar.
- Per vector wordt een tijdsproportionele statusbalk getoond voor de volledige laatste 24 uur, met CityGIS-statuskleuren en een herkenbaar onbekend segment.
- Tooltips tonen status, zichtbare duur en begin- en eindtijd en zijn bereikbaar via toetsenbordfocus.
- De percentages over de volledige 24 uur tonen beschikbaar (status 0 of 6), overige numerieke statussen onder 90, statussen vanaf 90 en onbekende tijd. De vier waarden tellen samen op tot 100%, met een passende afronding.
- APM, AE, CMD, MSERV, FAUB en AMB staan standaard open; alle overige vectortypes verschijnen in een uitklapbare groep wanneer die aanwezig zijn. Behoud de huidige groepering van AMBINC bij AMB.
- De bestaande live CityGIS-vernieuwingen blijven op de postpagina zichtbaar. Laden, lege resultaten, fouten en een tijdelijk verbroken liveverbinding hebben duidelijke toestanden.

## Carry from phase 32
1. `/locations/{id}/overview/` returns one shared `status_window` and per-vector `pagers`, `radios`, and chronologically clipped `status_periods`; each period has `status_code`, `status_description`, `status_abbreviation`, `status_color`, `starts_at`, `ends_at`, `duration_seconds`, and `is_unknown`.
2. The API response derives active physical links and the complete 24-hour timeline from existing relationships and status history; no schema or dependency change was made.

## Open follow-ups from phase 32
- none

## Tasks
- [x] task-01-post-navigation-and-vector-details.md
- [x] task-02-status-timeline-and-type-groups.md

## Carry-forward

### Carry from phase 33
1. The shareable route is `/posts/:postId`; the page loads the combined overview and uses the existing CityGIS SSE stream, refreshing the complete overview when that stream changes.
2. `postDashboardStatus.ts` groups types and computes whole-window rounded percentages; status segments are keyboard-focusable buttons with status, duration, and start/end details.
3. Focused UI and helper tests passed for route details, assets, live updates, period tooltip, percentages, and other-type expansion.

### Open follow-ups from phase 33
- Phase 31's optional Redis-gated Celery/SSE integration test previously failed to terminate and was stopped; do not treat it as verified by the regular suite.
