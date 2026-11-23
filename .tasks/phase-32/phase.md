---
phase: 32
title: Postdashboardgegevens
status: pending
opened: ~
closed: ~
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
