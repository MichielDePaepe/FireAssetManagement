---
id: task-01
title: Waarnemingsrelaties, TEI-koppeling en backfill
status: done
complexity: high
blocked-by: []
---
## Goal
Leg radio- en pagerrelaties op FirePlan-waarnemingen vast en koppel radio's via hun canonieke TEI, inclusief migratiebackfill en veilige snapshotvervanging.

## Context
`backend/fireplan/models.py` bevat `FireplanRadioObservation` met bron-item-ID en serienummertekst. `backend/fireplan/inventory_synchronization.py` vervangt de inventaris en waarnemingen atomisch na succesvolle ophalen. `backend/assets/models.py` bevat `RadioAsset` en `PagerAsset`; radio-TEI normalisatie bestaat al bij registratie/synchronisatie.

## Acceptance Criteria
- [x] Waarnemingen hebben optionele foreign keys naar radio en pager met een databaseconstraint die gelijktijdige koppeling verbiedt; bestaande bronitem-uniciteit blijft behouden.
- [x] Een datamigratie koppelt alleen bestaande lokaal opgeslagen radio-waarnemingen met geldige genormaliseerde TEI's en bewaart de oorspronkelijke serienummertekst.
- [x] Matching normaliseert alleen 14 cijfers door een afsluitende nul toe te voegen; 15 cijfers blijven ongewijzigd en ongeldige of onbekende waarden blijven niet gekoppeld.
- [x] Succesvolle inventarissynchronisatie bepaalt koppelingen opnieuw binnen de bestaande atomische snapshotvervanging; fouten bewaren de eerdere inventaris- en waarnemingsrelaties.
- [x] Gerichte regressietests tonen backfill, beide TEI-lengtes, ongeldige en niet-gematchte waarden, opnieuw koppelen en behoud bij mislukte synchronisatie.

## Notes
- Added explicit radio/pager foreign keys, an exclusivity constraint, local-data backfill, and TEI matching on each successful atomic snapshot replacement.
- Verified with 19 focused FirePlan model, synchronization, and migration tests; `makemigrations --check --dry-run` reported no drift.
