---
phase: 33
task: 2
title: Statusbalken, percentages en vectorgroepen
status: done
blocked-by: []
---
## Goal
Toon per vector de volledige 24-uurs statusperioden als tijdsproportionele balk met toegankelijke uitleg en de vereiste percentages en typegroepen.

## Context
Gebruik de `status_window` en `status_periods` van de postoverzichtsaanvraag. Behoud CityGIS-statuskleuren en de bestaande AMBINC-classificatie. De vier percentages worden berekend over het volledige venster.

## Acceptance Criteria
- [x] Statussegmenten zijn proportioneel aan hun duur en tonen onbekende perioden herkenbaar.
- [x] Tooltipinformatie bevat status, duur, begin en einde en is via toetsenbordfocus bereikbaar.
- [x] Beschikbaar, overige statussen onder 90, statussen vanaf 90 en onbekend tellen samen tot 100%.
- [x] APM, AE, CMD, MSERV, FAUB en AMB zijn standaard open; andere types staan in een groep die alleen bij aanwezigheid verschijnt.
- [x] AMBINC blijft bij AMB gegroepeerd.

## Notes
- Statusbalk gebruikt `status_periods` over de volle `status_window`; onbekend heeft een gearceerde neutrale stijl. Segmentknoppen zijn via toetsenbordfocus bereikbaar en beschrijven status, duur en tijden.
- Percentages gebruiken grootste-rest afronding zodat de vier categorieën samen 100% zijn; vectorgroepen volgen de gevraagde volgorde en AMBINC hoort bij AMB.
- Gerichte frontendtests: helper, detailpagina en overzicht 15/15 geslaagd.
