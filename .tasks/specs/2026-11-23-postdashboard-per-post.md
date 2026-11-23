---
kind: extension
date: 2026-11-23
phases:
  - name: Postdashboardgegevens
    goal: Breid de bestaande postoverzichtsaanvraag uit met actuele vectoren, voertuigen, fysieke assetkoppelingen en volledige statusperiodes voor de laatste 24 uur.
    exit-criteria: |
      - De postdashboardaanvraag geeft de postlocatie, alle actuele vectors van die post, gekoppelde voertuigen met beschikbare voertuigstatusvelden, toegewezen pagers en radio's, en alle statusperiodes die het venster van 24 uur overlappen terug.
      - Pagers worden via hun actieve vector-toewijzing gekoppeld; radio's worden via hun actieve vectorplaatsing gekoppeld. RiC/AdC-codes worden niet opgenomen.
      - Statusperiodes gebruiken de bron-effectieve tijd wanneer die bestaat en anders het waarnemingstijdstip; periodes worden aan de 24-uursgrenzen geknipt en tijd zonder bekende status wordt expliciet als onbekend weergegeven.
      - De aanvraag bevat voldoende historie om het hele 24-uursvenster te dekken en is niet beperkt tot de bestaande limiet van 50 statusrecords per vector.
  - name: Postdashboardinterface
    goal: Maak posten vanuit het overzicht aanklikbaar en toon per post een dashboard met vectoren, gekoppelde voertuigen en assets, en 24-uurs statusbalken.
    exit-criteria: |
      - Elke post opent een eigen deelbare route met terugnavigatie naar het postenoverzicht en toont de post zelf als locatie.
      - Per vector zijn de vectorcode, actuele CityGIS-status, bijbehorend voertuig en beschikbare voertuigstatusvelden, plus gekoppelde pagers en radio's zichtbaar.
      - Per vector wordt een tijdsproportionele statusbalk getoond voor de volledige laatste 24 uur, met CityGIS-statuskleuren en een herkenbaar onbekend segment.
      - Tooltips tonen status, zichtbare duur en begin- en eindtijd en zijn bereikbaar via toetsenbordfocus.
      - De percentages over de volledige 24 uur tonen beschikbaar (status 0 of 6), overige numerieke statussen onder 90, statussen vanaf 90 en onbekende tijd. De vier waarden tellen samen op tot 100%, met een passende afronding.
      - APM, AE, CMD, MSERV, FAUB en AMB staan standaard open; alle overige vectortypes verschijnen in een uitklapbare groep wanneer die aanwezig zijn. Behoud de huidige groepering van AMBINC bij AMB.
      - De bestaande live CityGIS-vernieuwingen blijven op de postpagina zichtbaar. Laden, lege resultaten, fouten en een tijdelijk verbroken liveverbinding hebben duidelijke toestanden.
  - name: Verificatie en documentatie
    goal: Dek de nieuwe postnavigatie, gegevenscombinatie en statusberekeningen af en houd de productdocumentatie actueel.
    exit-criteria: |
      - Backendtests dekken posttoegang, actieve pager- en radiokoppelingen, statusperioden aan venstergrenzen, ontbrekende historie, bron- en waarnemingstijden, en percentages.
      - Frontendtests dekken postnavigatie, vector- en assetweergave, alle typegroepen, tooltips/toetsenbordtoegang, vier percentages, onbekende perioden, laad-, fout- en lege toestanden en live updates.
      - De vereiste backend- en frontendchecks, linting en TypeScript-controles zijn uitgevoerd waar de lokale services beschikbaar zijn; niet-uitgevoerde checks worden met reden gerapporteerd.
      - README.md en SPEC.md beschrijven de postdashboardfunctie correct; ARCHITECTURE.md wordt alleen bijgewerkt als de feitelijke gegevensstroom wijzigt.
      - Er zijn geen nieuwe dependencies, tabellen of deploymentwijzigingen.
---
## Notes

Voeg aan het bestaande postenoverzicht een doorklikbaar postdashboard toe. De postdashboardpagina toont de postlocatie en alle actuele CityGIS-vectors die aan de post zijn gekoppeld. Per vector toont ze de vectoridentiteit, operationele CityGIS-status, overeenkomend CityGIS-voertuig met beschikbare FirePlan-statusvelden, en toepassingseigen fysieke assets: pagers en radio's. RiC/AdC-koppelingen blijven buiten scope.

De pagina toont voor elke vector de statusgeschiedenis van de laatste 24 uur als een horizontale balk, met segmentbreedten naar tijdsduur en de kleuren uit de bestaande CityGIS-statuscatalogus. Toon status, duur en begin- en eindtijd in een tooltip die ook met toetsenbordfocus werkt. Knip bekende periodes af op het vaste venster. Periodes waarvoor geen status bekend is krijgen een neutraal segment; bereken de percentages altijd over de volledige 24 uur. Toon beschikbaarheid voor status 0 of 6, overige numerieke statussen onder 90, statussen vanaf 90 en onbekend apart. Laat de vier percentages samen 100% vormen. Gebruik bestaande statuscodes en kleuren; voeg geen lokale statustaxonomie toe.

Toon de statusbalken standaard per vectortype in deze volgorde: APM, AE, CMD, MSERV, FAUB en AMB. Vectors van overige types staan in een uitklapbare groep die alleen verschijnt wanneer er zulke vectors zijn. Behoud de huidige classificatie waarbij AMBINC bij AMB hoort.

Er zijn twee gegevensroutes overwogen: meerdere bestaande aanvragen vanuit de browser combineren, of de postoverzichtsaanvraag uitbreiden zodat de post, vectors, voertuigen, assets en statusperiodes samen worden opgehaald. Kies de uitgebreide aanvraag om N+1 statusgeschiedenisaanvragen en de huidige limiet van 50 regels per vector te vermijden. Hergebruik de bestaande CityGIS-statushistoriek, inventoryrelaties, locatiegegevens en live CityGIS-eventstroom; introduceer geen nieuwe opslag, dependencies of deploymentarchitectuur.

De gebruiker heeft de ontwerpsecties goedgekeurd: navigatie en gegevens, 24-uurs statusbeeld, en afronding/scope. Bij ontbrekende tijd blijft het 24-uursvenster de noemer en wordt het aandeel onbekend expliciet getoond.
