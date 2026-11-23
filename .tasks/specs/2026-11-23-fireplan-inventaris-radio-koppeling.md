---
kind: extension
date: 2026-11-23
phases:
  - name: Radio-assets koppelen aan FirePlan-inventarissen
    goal: Koppel radio-waarnemingen uit opgeslagen FirePlan-inventarissen aan FAM-radios en toon de historische relatie vanuit inventaris- en radiodetails.
    exit-criteria: |
      - Elke FirePlan-inventaris kan meerdere toestelwaarnemingen bevatten en elke waarneming is één FirePlan-item. Een toestel kan in meerdere inventarissen voorkomen.
      - De waarnemingsgegevens bewaren het oorspronkelijke FirePlan-serienummer en de item-ID. Een waarneming kan naar hoogstens één asset verwijzen: een radio of, in de toekomst, een pager. Beide assetverwijzingen mogen leeg zijn voor een item dat nog niet aan een FAM-asset is gekoppeld; radio en pager kunnen nooit tegelijk gekoppeld zijn.
      - Radio-matching gebeurt op de TEI. Een TEI/serienummer van 14 cijfers wordt voor de match genormaliseerd door er een `0` achter te zetten; een waarde van 15 cijfers blijft ongewijzigd. De bronwaarde blijft ongewijzigd opgeslagen. Niet-gematchte items blijven zichtbaar en laten synchronisatie slagen.
      - Bestaande radio-waarnemingen worden tijdens een datamigratie gekoppeld waar een genormaliseerde TEI overeenkomt; de backfill gebruikt alleen lokaal opgeslagen data.
      - Een succesvolle inventarissynchronisatie koppelt de opgehaalde radio-items opnieuw, zodat eerder niet-gematchte items gekoppeld kunnen worden zodra de radio in FAM bestaat. Een mislukte synchronisatie behoudt de vorige succesvolle inventarissnapshot en haar relaties.
      - De inventarisdetailpagina toont alle radio-waarnemingen met hun oorspronkelijke serienummer en linkt gekoppelde radio's door naar hun detailpagina. Niet-gematchte waarnemingen blijven zichtbaar.
      - De radiodetailpagina toont alle inventarissen waarin de radio is waargenomen, met inventarisdatum en beschikbare voertuig- en vectorinformatie, en linkt terug naar de inventarisdetailpagina.
      - De structuur bereidt expliciete pagerrelaties voor, maar koppelt in deze fase alleen radio's omdat pagers nog niet in FirePlan-inventarissen voorkomen.
      - Tests dekken de datamigratie, 14- en 15-cijferige TEI-matching, meerdere toestellen per inventaris, niet-gematchte items, weergave en links aan beide kanten, en behoud van de vorige snapshot na een synchronisatiefout. Vereiste backend-, frontend-, lint- en TypeScript-checks worden gerapporteerd.
      - README, SPEC en ARCHITECTURE beschrijven de nieuwe koppeling en weergaven waar relevant; er worden geen nieuwe dependencies of configuratievariabelen toegevoegd.
---
## Notes

### Bestaande gegevens en gedrag

`FireplanInventory` bewaart al de voertuig- en vectorrelatie voor een inventaris. Die vector wordt bij synchronisatie bepaald op basis van `VectorVehicleHistory` op het afsluitmoment van de inventaris. Voor inventarissen zonder succesvolle lokale synchronisatie reconstrueert de overzichts-API de relatie momenteel ter plekke. Deze uitbreiding verandert dat gedrag niet; de opgeslagen inventarisvector blijft de historische snapshot.

Radio-items uit FirePlan worden nu in `FireplanRadioObservation` bewaard met inventaris, FirePlan-item-ID, itemtype-ID en serienummertekst. Er is nog geen foreign key naar `RadioAsset`. Radio-TEI's in FAM zijn unieke cijferstrings; invoer van 14 cijfers wordt bij registratie en synchronisatie al genormaliseerd door een afsluitende nul toe te voegen. FirePlan-inventarissen bevatten momenteel alleen de gemapte radio-items.

### Gekozen gegevensmodel

Behoud één rij per waargenomen FirePlan-item en breid dit waarnemingsmodel uit met optionele foreign keys naar radio en pager. Een expliciete `radio`- en `pager`-foreign key behoudt relationele integriteit en ondersteunt de later gewenste toestelsoorten. Sta toe dat beide foreign keys leeg zijn om een bewaard maar niet-gematcht bronitem weer te geven; dwing in de database af dat ze niet gelijktijdig gevuld zijn. Behoud de unieke combinatie van inventaris en FirePlan-item-ID, zodat meerdere verschillende items per inventaris zijn toegestaan.

Gebruik geen generieke content-type-relatie: die zou de database geen gewone foreign-key-integriteit naar het assetrecord bieden. Pagers worden in deze fase niet uit FirePlan-inventarissen opgehaald of gekoppeld.

### Matching en synchronisatie

Koppel elke radio-waarneming aan een bestaand radiorecord door de FirePlan-serienummerwaarde als TEI te vergelijken met de canonieke FAM-TEI. Normaliseer een 14-cijferige TEI/serienummerwaarde voor de vergelijking door er een `0` achter te zetten; laat 15 cijfers ongewijzigd. Bewaar de oorspronkelijke FirePlan-serienummertekst zonder herschrijving. Waarden die niet als geldige 14- of 15-cijferige TEI kunnen worden geïnterpreteerd, of waarvoor geen radiorecord bestaat, blijven niet gekoppeld en veroorzaken geen synchronisatiefout.

Backfill de bestaande lokale radio-waarnemingen tijdens de migratie met dezelfde matchregel. Tijdens iedere latere succesvolle synchronisatie worden de radioverwijzingen opnieuw bepaald; daardoor kan een waarneming die eerst niet gematcht was alsnog worden gekoppeld nadat de radio is aangemaakt. Hergebruik de bestaande FirePlan-synchronisatietaak en de huidige atomische vervanging van de succesvolle snapshot. Bij een mislukte poging blijven de vorige radio-waarnemingen en koppelingen intact.

### Weergave

Voeg aan de bestaande inventarisdetailweergave een assetlink toe per radio-waarneming, naast het ruwe serienummer. Toon niet-gematchte waarnemingen zonder link als niet gekoppeld. Voeg aan de radiodetailweergave een sectie met historische inventariswaarnemingen toe. Toon per rij de inventarisdatum, de inventarislink en de beschikbare voertuig- en vectorkoppeling die al op `FireplanInventory` is opgeslagen. Dit model ondersteunt zo meerdere assets per inventaris en herhaalde waarneming van hetzelfde asset in meerdere inventarissen.

### Buiten scope

Deze uitbreiding haalt geen nieuwe FirePlan-itemtypen op, koppelt geen pagers, verandert de regels voor vectorhistoriek niet, en voegt geen assetvergelijking, waarschuwingen, nieuwe synchronisatiearchitectuur, dependencies of configuratie toe.
