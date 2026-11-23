---
phase: 33
task: 1
title: Postnavigatie en vectorgegevens
status: done
blocked-by: []
---
## Goal
Maak elke post in het bestaande dashboard aanklikbaar en bouw een deelbare postdetailroute die de post en bijbehorende vector-, voertuig- en assetgegevens toont.

## Context
Gebruik `getLocationOverview` en de bestaande CityGIS SSE-vernieuwingen. Behoud de bestaande navigatie naar het postenoverzicht en voeg duidelijke laad-, fout-, lege en tijdelijke liveverbindingsstatussen toe.

## Acceptance Criteria
- [x] Elke postlink opent een eigen route; terugnavigatie naar het postenoverzicht werkt.
- [x] De detailpagina toont de post, alle vectors met actuele status en gekoppeld voertuig met beschikbare statusvelden.
- [x] Per vector worden gekoppelde pagers en radio's zichtbaar; RiC/AdC blijft afwezig.
- [x] CityGIS SSE-vernieuwingen blijven zichtbaar op de detailpagina.
- [x] Laden, lege resultaten, fouten en een tijdelijk verbroken liveverbinding hebben duidelijke toestanden.

## Notes
- Postlinks openen `/posts/:postId`; de detailpagina gebruikt de uitgebreide postoverzichtsaanvraag, toont voertuigvelden en fysieke assets, en voegt live CityGIS-vectorwaarden samen.
- De pagina heeft terugnavigatie, laad-, lege-, fout- en SSE-verbindingsmeldingen; geen nieuwe dependency.
- Gerichte frontendtests: DashboardPage en PostDashboardPage 10/10 geslaagd.
