---
phase: 33
title: Postdashboardinterface
status: pending
opened: ~
closed: ~
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

## Tasks
