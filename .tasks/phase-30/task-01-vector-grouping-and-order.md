---
id: task-01
title: Vectoren groeperen en sorteren
status: done
complexity: medium
blocked-by: ~
---
## Goal
Maak een geteste, herbruikbare frontendfunctie die CityGIS-vectoren per post groepeert in de vijf dashboardkolommen, met de afgesproken status-, beschikbaarheids- en Rest-volgorde.

## Context
De dashboardindeling is vastgelegd in `.tasks/specs/2026-11-22-dashboard-postenoverzicht.md`. `CityGISVector` bevat `post`, `resource_type_code`, `operational_status_code`, `vehicle`, `abbreviation` en `vector_code`. Toon alleen actuele vectoren (`is_current`) en behoud posten zonder vectoren in het resultaat.

## Acceptance Criteria
- [x] Alleen locaties met kind `post` verschijnen; sorteer op `sort_name`, daarna naam, en houd lege posten bij.
- [x] APM vereist exact type `APM`; AE vereist exact `AE`; AMB bevat exact `AMB` en `AMBINC`; statuscodes >=90 gaan naar Status 90+ behalve `99`, dat altijd Rest is.
- [x] Rest sorteert exact `CMD`, `MSERV`, `FAUB`, vervolgens status `99`, daarna overige types; gelijke waarden hebben een stabiele numerieke, locale-bewuste sleutel.
- [x] Beschikbaarheid telt uitsluitend status `0` en `6`; de functie levert aantallen per kolom.
- [x] Tests zijn eerst geschreven en falen vóór de implementatie; gerichte tests slagen na de implementatie.

## Notes
- Added `dashboardGrouping.ts` with current-vector grouping, post sorting, Rest priority and availability totals.
- Added five test-first cases in `dashboardGrouping.test.ts`; targeted Vitest and TypeScript checks pass.
