---
phase: 32
title: Postdashboardgegevens
status: closed
opened: 2026-11-23
closed: 2026-11-23
---
## Goal
Breid de bestaande postoverzichtsaanvraag uit met actuele vectoren, voertuigen, fysieke assetkoppelingen en volledige statusperiodes voor de laatste 24 uur.

## Carry from phase 31
1. The dashboard continues to use the existing CityGIS snapshot/history API and SSE stream; the dashboard feature added no backend or deployment architecture.

## Open follow-ups from phase 31
- The optional Redis-gated Celery/SSE integration test did not terminate during its forced run and was stopped; the regular backend suite passed with that one test skipped.

## Exit Criteria
- De postdashboardaanvraag geeft de postlocatie, alle actuele vectors van die post, gekoppelde voertuigen met beschikbare voertuigstatusvelden, toegewezen pagers en radio's, en alle statusperiodes die het venster van 24 uur overlappen terug.
- Pagers worden via hun actieve vector-toewijzing gekoppeld; radio's worden via hun actieve vectorplaatsing gekoppeld. RiC/AdC-codes worden niet opgenomen.
- Statusperiodes gebruiken de bron-effectieve tijd wanneer die bestaat en anders het waarnemingstijdstip; periodes worden aan de 24-uursgrenzen geknipt en tijd zonder bekende status wordt expliciet als onbekend weergegeven.
- De aanvraag bevat voldoende historie om het hele 24-uursvenster te dekken en is niet beperkt tot de bestaande limiet van 50 statusrecords per vector.

## Tasks
- [x] task-01-post-overview-data-contract.md

## Carry-forward

### Carry from phase 32
1. `/locations/{id}/overview/` returns one shared `status_window` and per-vector `pagers`, `radios`, and chronologically clipped `status_periods`; each period has `status_code`, `status_description`, `status_abbreviation`, `status_color`, `starts_at`, `ends_at`, `duration_seconds`, and `is_unknown`.
2. The API response derives active physical links and the complete 24-hour timeline from existing relationships and status history; no schema or dependency change was made.

### Open follow-ups from phase 32
- none
