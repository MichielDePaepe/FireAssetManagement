---
kind: extension
date: 2026-11-25
phases:
  - name: Suivo API en actuele kopie
    goal: Verbind FAM veilig met de Suivo API en synchroniseer assets, devices en de beschikbare actuele status zonder brongegevens in Suivo te wijzigen.
    exit-criteria: |
      - Suivo OAuth Client Credentials gebruikt `SUIVO_CLIENT_ID` en `SUIVO_CLIENT_SECRET` uit `.env`; `.env.example` documenteert beide zonder echte waarden. Tokens en credentials verschijnen niet in logs of browserresponses.
      - De API-client leest units, devices en beschikbare actuele unitstatus via de Suivo API en gebruikt stabiele Suivo-ID's voor idempotente opslag. Niet meer teruggegeven bronrecords worden niet stilzwijgend verwijderd.
      - Eén handmatige volledige synchronisatie gebruikt de bestaande Celery-task-, voortgangs-, resultaat- en SSE-patronen. Een mislukte of gedeeltelijke run behoudt de vorige succesvolle kopie en rapporteert de fout.
      - Synchronisatie is uitsluitend leesverkeer richting Suivo. Automatische retries zijn begrensd en respecteren bestaande tasklimieten.
      - De accounttest bevestigt of Client Credentials werkt, welke units/devices toegankelijk zijn, welke ongekoppelde devices Suivo teruggeeft en welke actuele telemetryvelden die daadwerkelijk leveren. Als authenticatie of toegang ontbreekt, wordt dat duidelijk gerapporteerd zonder een alternatieve grant of extra credentials stilzwijgend in te voeren.
      - Backendtests dekken OAuth-fouten zonder secrets te lekken, mapping van Suivo-antwoorden, idempotente updates, lege/onvolledige telemetry, en behoud van de vorige succesvolle snapshot na fouten.
  - name: Tracker- en assetoverzichten
    goal: Toon alle Suivo-assets en devices in twee overzichtstabellen en koppel Suivo-units automatisch aan FAM-voertuigen op naam.
    exit-criteria: |
      - De hoofdnav bevat **Trackers** met de tabs **Assets** en **Trackers**. Assets toont Suivo-units; Trackers toont de devices die de API op het account teruggeeft, inclusief devices zonder gekoppelde unit. Het werkelijke device-type blijft zichtbaar.
      - Een Suivo-unit koppelt alleen aan een FAM/CityGIS-voertuig wanneer de voertuig-/assetnaam na trimmen van buitenste spaties en case-normalisatie exact overeenkomt. Gedeeltelijke/fuzzy matches worden niet gebruikt. Geen-match en meerdere matches zijn herkenbaar en linken niet automatisch.
      - De assettabel toont Suivo-assetnaam/type, eventuele FAM-voertuigmatch, gekoppeld device, laatst gehoord, beschikbare batterijgegevens en laatste locatie. De trackertabel toont device-identificatie/type, gekoppelde unit indien aanwezig, laatst gehoord, beschikbare batterijgegevens en locatie voor zover de API die levert.
      - De UI toont de tijd van `last-seen` en de tijd van een positie afzonderlijk waar ze verschillen. `battery-level` en batterijspanning zijn verschillende waarden; spanning verschijnt alleen waar de Suivo-respons die expliciet levert. Ontbrekende velden worden als niet beschikbaar getoond.
      - De interface claimt geen actief abonnement wanneer de API geen expliciete abonnementsstatus levert. Ontbrekende telemetry wordt niet als bewijs van een verlopen abonnement geïnterpreteerd.
      - De tabel heeft zoeken, stabiele sortering en de vaste toegankelijke tabelstijl uit `AGENTS.md`. Alle interactieve acties hebben toegankelijke namen en laad-, lege-, fout- en verouderde-data-toestanden.
      - De pagina is read-only voor Suivo-koppelingen en toestelbeheer. FAM bevat geen actie om devices te verplaatsen, units te wijzigen of een tracker lokaal aan een voertuig/locatie toe te wijzen.
  - name: Suivo push en dagelijkse reconciliatie
    goal: Verwerk Suivo-unitstatusupdates bijna direct en herstel gemiste updates met een dagelijkse volledige reconciliatie en handmatige refresh.
    exit-criteria: |
      - Eén dedicated achtergrondproces opent de Suivo WebSocket, authenticeert met een access token en abonneert zich op `UNIT_STATUS`. Het proces antwoordt op Suivo-pings, herverbindt met begrensde backoff en verwerkt events idempotent.
      - Er wordt maximaal één Suivo-WebSocketverbinding voor deze integratie gebruikt. Logs tonen verbindings- en foutstatus zonder credentials, access tokens of gevoelige payloads.
      - De volledige reconciliatie wordt eenmaal per dag via Celery Beat ingepland. De planning gebruikt één schedulerinstantie en herstelt veilig na herstart.
      - De knop **Alles vernieuwen** start direct een volledige synchronisatietaak via de bestaande Celery/SSE/task-result-flow. De UI toont taakvoortgang, resultaat en het tijdstip van de laatste geslaagde volledige sync.
      - Bij verlies van de pushverbinding blijven de laatste gegevens zichtbaar met hun bron-tijdstempels; na reconnect en de volgende volledige sync wordt de kopie gereconcilieerd. FAM veronderstelt niet dat Suivo push-events buffert.
      - Compose-documentatie beschrijft de consumer- en Beat-service, health/restartgedrag en de schedulerstatus. Er wordt geen tweede taakframework of resultaatopslag geïntroduceerd.
      - Tests dekken push-authenticatie, subscriptionberichten, statusupdates, pings, reconnects, idempotentie, taakvoortgang, schedulerconfiguratie en handmatige refresh. Eventuele WebSocket-clientdependency wordt alleen toegevoegd als bestaande packages niet volstaan; de reden en licentie worden dan in dependencydocumentatie vermeld.
  - name: Accountvalidatie en documentatie
    goal: Verifieer de Suivo-contractgrenzen tegen de bereikbare account en documenteer de uiteindelijke velden, bediening en operationele randvoorwaarden.
    exit-criteria: |
      - De accountvalidatie bevestigt de beschikbare Suivo-device-types en of ongekoppelde devices status, positie of batterijvelden leveren. De UI en documentatie beloven alleen bevestigde velden.
      - FAM-, Suivo- en voertuignamen met geen, één en meerdere mogelijke matches worden gecontroleerd; geen afwijkende koppeling wordt stilzwijgend opgeslagen.
      - README, `.env.example`, `SPEC.md` en `ARCHITECTURE.md` beschrijven de integratie, OAuth-variabelen, push-consumer, dagelijkse reconciliatie, handmatige refresh, stale-data-gedrag en herstelbeperkingen.
      - Backend pytest, frontend Vitest, Python lint, ESLint en TypeScript-checks worden uitgevoerd wanneer de vereiste diensten beschikbaar zijn; niet-uitvoerbare checks en oorzaken worden gemeld.
      - Er worden geen Suivo-writes, FAM-side verplaatsingen, abonnementsbeheer, historische positietracks of nieuwe map-/operationele workflows toegevoegd.
---
## Notes

### Bronnen en bestaande FAM-context

FAM haalt actuele voertuigen uit CityGIS en heeft al staff-pagina's met tabs, doorzoekbare/sorteerbare tabellen, Celery-taken, taakresultaten en SSE-voortgang. De nieuwe Tracker-pagina volgt die gedeelde patronen. De gebruiker wil twee tabellen: Suivo-assets met een automatische relatie naar het overeenkomstige FAM-voertuig en hun eventuele gekoppelde tracker, plus alle Suivo-trackers/devices.

De meegeleverde Suivo-documentatie beschrijft `GET /units` voor voertuigen/units, `GET /devices` voor devices op het account met hun eventuele unit, en `GET /units-last-status` voor actuele unitstatus. Statusvelden kunnen `last-seen`, laatste positie, `battery-level`, modulestatus, beweging, poorten, temperatuur en CAN-gegevens omvatten. Welke velden actueel zijn hangt volgens de API af van device-type, abonnement en configuratie. De API beschrijft batterijspanning als CAN-data; dit is niet hetzelfde als het algemene `battery-level`. De aparte battery-information-resource beschrijft het geïnstalleerde batterijtype voor A-Track devices.

De `/devices`-schema's maken de unitrelatie optioneel en de documentatie noemt devices gekoppeld aan units “if any”; ongekoppelde devices lijken dus ondersteund. De API specificeert geen expliciet actief-abonnementsveld in dit device-schema. Een echte accounttest moet bepalen welke devices en telemetry met de bedoelde OAuth-client zichtbaar zijn. De `UNIT_STATUS` WebSocket-topic pusht wijzigingen zoals posities; Suivo buffert events niet bij een disconnect, vereist ping-respons en beperkt het aantal verbindingen per accountgebruiker tot drie. Daarom gebruikt FAM één consumer en een dagelijkse volledige reconciliatie.

De Suivo API gebruikt OAuth 2.0. De documentatie ondersteunt Client Credentials voor integraties die aan één customer-account zijn gekoppeld; controleer dat dit voor de FAM-client geldt. Remote API-toegang kan daarnaast aan Suivo-zijde voor het betrokken account/gebruiker moeten zijn ingeschakeld. Behandel een authenticatie- of permissiefout als setup-fout en voeg geen andere grant of gebruikerscredentials toe zonder de vereiste herziening.

### Gegevensgrenzen en matching

Suivo is de bron van waarheid voor units, devices, koppelingen en toestelstatus. FAM bewaart een lokale actuele kopie voor zoeken en tonen; het maakt geen Suivo-wijzigingen. Een Suivo-unit matcht op de exacte assetnaam met de FAM/CityGIS-voertuignaam, na het verwijderen van buitenste spaties en case-normalisatie. Een gedeeltelijke match wordt afgewezen. Geen-match en meervoudige match blijven zichtbaar zonder automatische relatie. Behoud Suivo-bron-ID's als integratiesleutels; voertuigmatches zijn afgeleid van de namen en worden bij synchronisatie opnieuw berekend.

Toon device-type en Suivo-identificatie uit de `/devices`-respons. Maak geen abonnementstatus afgeleid uit afwezige telemetry. Laat `last-seen` (laatste geslaagde communicatie) niet samenvallen met het tijdstip van de laatste positie. Toon batterijniveau en spanning met hun afzonderlijke bronnaam en alleen als die voor het betreffende device werkelijk aanwezig zijn. Ongekoppelde devices mogen geen unitstatus hebben; toon dan hun identiteit en unit-linkstatus zonder verzonnen online-, positie- of batterijwaarde.

Historische ritten/positietracks kunnen later worden aangevraagd via geschikte Suivo-history endpoints; ze worden in deze uitbreiding niet lokaal gearchiveerd. FAM beheert evenmin een aparte locatieplaatsing voor apparaten in labo of herstelling. Zulke status of een relatie met een locatie moet in Suivo beheerd worden en kan alleen worden getoond als de API die relatie levert.

### Synchronisatie en operationele vorm

Een volledige REST-synchronisatie loopt als een bestaande Celery-taak met persistente voortgang en SSE. Een succesvolle run upsert de actuele units, devices en beschikbare statussnapshot op bron-ID. Bewaar de laatst geslaagde kopie bij fouten; verwijder ontbrekende bronrecords niet automatisch omdat de zichtbaarheid per OAuth-account/permissie kan verschillen. Registreer laatste volledige sync en fouten voor staff-gebruikers.

Gebruik de Suivo-WebSocket alleen voor `UNIT_STATUS` om bij push events de lokale actuele status te vernieuwen. Een dedicated beheerd proces houdt de ene upstream socket open, antwoordt op ping, verwerkt `error-message`, en reconnect met begrensde backoff. Voor volledigheid draait Celery Beat één dagelijkse volledige sync. De handmatige knop start dezelfde Celery-synchronisatie onmiddellijk. Push-events zijn niet gebufferd en daarom vervangen ze de reconciliatie niet.

`SUIVO_CLIENT_ID` en `SUIVO_CLIENT_SECRET` leven uitsluitend in `.env`/deployment environment en worden opgenomen als lege/documenterende waarden in `.env.example`. Client secrets en access tokens blijven server-side. De WebSocket-consumer en Celery Beat voegen een rol/service toe aan Compose; ze hergebruiken bestaande Django-, Celery-, Redis-, PostgreSQL-, resultaten- en SSE-infrastructuur. Controleer de huidige dependencyset voor een WebSocket-client voordat een package wordt toegevoegd.

### Buiten scope

FAM verandert of verplaatst geen Suivo-device en kent lokaal geen trackers toe aan voertuigen of locaties. De uitbreiding beheert geen Suivo-abonnementen en claimt niet te bepalen of een device een actief abonnement heeft. Ze bewaart geen volledige routegeschiedenis, creëert geen historische relatiejournal, wijzigt geen CityGIS- of Suivo-namen en voegt geen map, alarm- of interventieworkflow toe.
