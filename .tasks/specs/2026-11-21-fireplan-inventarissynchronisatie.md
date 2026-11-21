---
kind: extension
date: 2026-11-21
phases:
  - name: FirePlan-contract en mapping
    goal: Verifieer de actuele inventarisrespons, datum- en wijzigingssemantiek en bouw een beperkte YAML-mapping voor selectieve radio-extractie.
    exit-criteria: |
      - De gepagineerde lijst, `updatedAt`, `closedAt`, `vehicleAlphaCode`, containerboom en itemlijst zijn gevalideerd tegen de actuele FirePlan-respons.
      - `itemTypeId: 1010` wordt gebruikt voor Radio portable Astrid; Cabine de conduite wordt op de beschikbare containernaam geselecteerd omdat container-UUID's per inventaris verschillen.
      - De datum zonder tijdzone wordt als Europe/Brussels geïnterpreteerd en tijdzonebewust opgeslagen.
      - De betrouwbaarheid van `updatedAt` voor inhoudswijzigingen is vastgesteld. Als FirePlan die wijziging niet betrouwbaar signaleert, wordt geen efficiënte automatische wijzigingsdetectie geclaimd en wordt geen volledige detailboom elk uur gedownload.
      - De mapping kan later materiaaltypes toevoegen zonder een generieke mapping-engine of frontend-editor.
      - De YAML-parser is een expliciete dependency als geen bestaande directe dependency die functie al levert; documenteer de reden en dependency.
  - name: Opslag en Celery-synchronisatie
    goal: Bewaar FirePlan-inventarissen op basis van hun unieke UUID, verwerk selectieve radioresultaten idempotent en gebruik de bestaande Celery- en taakresultaatinfrastructuur.
    exit-criteria: |
      - Per inventaris worden bronmetadata, synchronisatiestatus, laatste succesvolle synchronisatietijd, laatste fout, bronwijzigingstijd en toegepaste mappingversie bewaard.
      - De metadata bevat voertuigcode, inventarislocatie, uitvoerder, toezichthouder, aanmaak-, sluit- en wijzigingstijd en beschikbare inventarisstatusvelden.
      - Alleen relevante radioresultaten worden als JSON bewaard; gestructureerde observaties bewaren FirePlan-item-ID en TEI als tekst, inclusief voorloopnullen.
      - Unieke beperkingen op inventaris-UUID en inventaris plus item-ID voorkomen dubbele inventarissen en vaststellingen.
      - Een succesvolle hersynchronisatie vervangt bronresultaat en observaties atomair volgens de actuele YAML-mapping. Een mislukte poging bewaart de laatste succesvolle data en registreert de fout.
      - De historische koppeling matcht `vehicleAlphaCode` alleen eenduidig met een FAM-voertuig en bewaart het FAM-voertuig/FirePlan-ID plus de oorspronkelijke code.
      - De vector wordt op basis van de bestaande `VectorVehicleHistory` bepaald voor het FirePlan-inventaristijdstip, met `observed_at` en `ended_at` als intervalgrenzen. De mogelijke afwijking van ongeveer één minuut door de CityGIS-synchronisatie is aanvaardbaar.
      - Als er voor het voertuig geen historische relatiegegevens beschikbaar zijn, blijft de vector onbekend. Er komen geen betrouwbaarheidsniveaus, onzekerheidsintervallen of complexere reconstructielogica.
      - Een handmatige periodeopdracht haalt details altijd opnieuw op. Een uurrooster verwerkt nieuwe, gewijzigde of met een andere mappingversie verwerkte inventarissen via Celery Beat.
      - De taak rapporteert voortgang en resultaten met de bestaande task-ID, `celery-progress`, `django-celery-results` en SSE; er komt geen parallel taak- of resultaatframework.
  - name: Beheerinterface
    goal: Toon de FirePlan-inventarislijst met FAM-synchronisatiestatus en laat beheerders inventarissen per periode opnieuw verwerken.
    exit-criteria: |
      - De beheerpagina vraagt alleen gepagineerde inventarissamenvattingen op en downloadt geen details zolang geen synchronisatie loopt.
      - De lijst bevat ook niet-opgeslagen FirePlan-inventarissen en toont per record synchronisatiestatus, laatste succesvolle synchronisatiedatum en foutmelding.
      - Begindatum en einddatum starten een inclusieve hersynchronisatie; validatie weigert ongeldige of omgekeerde datums.
      - De lopende taak en het eindrapport zijn bereikbaar via de bestaande taakvoortgangs- en taakdetailinterface.
      - Toegang volgt het bestaande beheerderspatroon. Er is geen volledige inventarisboomviewer.
  - name: Verificatie en documentatie
    goal: Verifieer API-, opslag-, historische koppel-, fout- en UI-gedrag en beschrijf de actuele module en beperkingen.
    exit-criteria: |
      - Backendchecks dekken paginering, veldvalidatie, tijdzone, idempotentie, gewijzigde bronrecords, mappingwijzigingen, foutbehoud en onbetrouwbare of ontbrekende relaties.
      - Frontendchecks dekken laden, lege lijst, API-fout, niet-gesynchroniseerde rijen, datumvalidatie, lopende voortgang en eindresultaat.
      - Python-lint, frontend-lint en TypeScript-controles zijn uitgevoerd; niet-beschikbare lokale diensten of tools worden expliciet gerapporteerd.
      - `SPEC.md`, `ARCHITECTURE.md`, `README.md` en waar nodig `.env.example` weerspiegelen de implementatie.
      - De gekozen YAML-parserdependency is opgenomen in de dependencydocumentatie.
---
## Notes

### Context en bestaande bouwstenen

Deze extensie voegt FirePlan-inventarisverwerking toe aan de bestaande FirePlan-integratie van FAM. Hergebruik de opgeslagen, versleutelde FirePlan-credentials en sessiecookies, de bestaande HTTPS-client, Celery-worker en Celery Beat, `celery-progress`, `django-celery-results`, taak-ID's, SSE en de huidige beheerdersnavigatie. Voeg geen tweede queue, taakresultaatmodel, eventbus of synchronisatieframework toe.

De huidige FAM-code synchroniseert FirePlan-pagers en haalt voertuigen op voor CityGIS. De inventarisfuncties hebben nog geen eigen bronmodel of synchronisatie. `Vehicle` heeft een uniek `fireplan_id`; `VectorVehicleHistory` bewaart `observed_at`, `ended_at` en `source_effective_at`. CityGIS wordt elke minuut gesynchroniseerd. Voor deze toepassing is een mogelijke afwijking van ongeveer één minuut tussen de werkelijke wijziging en de waarneming aanvaardbaar.

### FirePlan-API en mapping

De live FirePlan-respons is op 21 november 2026 alleen-lezen gecontroleerd. De gesloten inventarislijst gebruikt `/fr/api/inventory/inventories-type/close` met offset/paginering en sortering op `closedAt`. De inventarisrecord-UUID is de deduplicatiesleutel. De respons bevat onder meer `vehicleAlphaCode`, `inventoryTypeName`, `doneInName`, `doneByFullName`, `overseenByFullName`, `closedAt`, `createdAt`, `updatedAt` en statusvelden. De lijstrespons bevatte geen stabiel voertuig-ID; behoud de oorspronkelijke voertuigcode en koppel alleen bij een eenduidige overeenkomst met de voertuigen die FAM kent.

Per inventaris levert `/fr/api/inventory/inventories-type/close/{inventory_uuid}/inventoried-container/tree` de boom met `id`, `parentId`, `nameFr` en `nameNl`. De container-ID is een UUID per inventaris, niet een configureerbare vaste container-ID. Selecteer daarom de container met exacte Franse naam `Cabine de conduite`, zoals de bronrespons die exposeert. Haal vervolgens alleen de items van die container op via `/fr/api/inventory/inventories-type/close/inventoried-container/{container_uuid}/inventoried-item/list`. De respons bevat `itemTypeId`, `itemTypeName`, item-`id` en `trackedItemSerialNumber`. In twee bekeken inventarissen was de type-ID voor `Radio portable Astrid` gelijk aan `1010`, terwijl container- en item-UUID's per inventaris verschilden. Gebruik `itemTypeId: 1010` als primaire typefilter en controleer de typebenaming als leesbare validatie; bewaar de TEI als tekst om voorloopnullen te behouden.

Bewaar niet de volledige inventarisboom. Sla de relevante bronmetadata en alleen de geselecteerde radio-items op als JSON; maak daarnaast gestructureerde observatieregels voor opzoeking en toekomstige koppeling. De beheerpagina leest alleen de gepagineerde lijst. Detail-API-aanroepen gebeuren alleen wanneer een inventaris nieuw, gewijzigd, handmatig opnieuw aangevraagd of met een gewijzigde mappingversie te verwerken is.

`updatedAt` was aanwezig in de live lijstrespons, maar de semantiek bij een wijziging aan een eerder afgesloten inventaris is tijdens de inspectie niet bewezen. De eerste fase moet dit vaststellen. De automatische synchronisatie mag alleen op dit veld vertrouwen wanneer het wijzigingsgedrag is bevestigd. Als dat niet kan, leg de beperking voor en laad niet stilzwijgend alle details elk uur. Controleer ook de ondersteunde datumfilters/paginering voordat een periodeophaling wordt geoptimaliseerd; een client-side scan mag aflopend gepagineerde samenvattingen lezen en stoppen zodra `closedAt` vóór de begindatum valt.

### Historische koppeling en hersynchronisatie

Gebruik de FirePlan-`uuid` als unieke sleutel en `closedAt` als tijdstip waarop de inventaris is uitgevoerd. FirePlan leverde in de gecontroleerde respons geen tijdzone-offset; interpreteer deze lokale datum/tijd volgens FAM's Europe/Brussels-tijdzone en bewaar een aware tijdstip.

Een voertuig wordt alleen gekoppeld wanneer `vehicleAlphaCode` exact en eenduidig naar een FAM-voertuig verwijst. Bewaar het stabiele lokale voertuigrecord/FirePlan-ID en de originele code. Bepaal daarna de vector met de bestaande `VectorVehicleHistory`: zoek de relatiegeschiedenis voor dat voertuig waarvan het waarnemingsinterval het `closedAt`-tijdstip omvat (`observed_at` ligt ervoor of erop; `ended_at` ligt erna of ontbreekt). De intervalgrenzen weerspiegelen wanneer CityGIS de koppeling heeft waargenomen; de maximaal ongeveer één minuut mogelijke afwijking is voor dit doel voldoende betrouwbaar. Als er geen bruikbare historische relatiegegevens zijn, blijft de vector onbekend. Voeg geen betrouwbaarheidsniveaus, onzekerheidsintervallen of complexere reconstructielogica toe.

Een handmatige datumperiode herverwerkt alle inventarissen binnen de inclusieve lokale datums, ook als ze al bestaan. Ze haalt FirePlan-details opnieuw op, past de actuele YAML-mapping toe, berekent de voertuig-vectorkoppeling opnieuw via `VectorVehicleHistory` op het inventaristijdstip en werkt de bestaande UUID-records bij. Verwijder of vervang observaties alleen binnen dezelfde database-transactie als de complete detailophaling en validatie slaagt. Unieke beperkingen en upserts voorkomen dubbele inventarissen; de set radio-observaties wordt vervangen op basis van FirePlan-item-ID zodat een nieuwe extractie geen duplicaten achterlaat.

### Beheer, taken en grenzen

Plaats een eenvoudige pagina onder Beheer. Combineer de FirePlan-samenvattingspagina met lokale synchronisatiestatus en toon niet-opgeslagen inventarissen als `Niet gesynchroniseerd`. Voorzie server-side paginering of incrementeel laden, twee datumvelden en een taakactie. Een fout per inventaris moet zichtbaar blijven in de lijst en het Celery-eindrapport. Gebruik de bestaande SSE-taakdetails voor voortgang; geplande runs moeten geen onnodige permanente taakresultaten verzamelen.

De eerste mapping betreft uitsluitend draagbare ASTRID-radio's in `Cabine de conduite`. YAML kan later andere materiaaltypes zoals pagers bevatten, maar krijgt geen frontend-editor en wordt geen complexe generieke engine.

Buiten scope blijven: dagelijkse afwijkingsdetectie, verwachte-versus-vastgestelde vergelijking, dashboard voor postoversten, incidentenbeheer, correctieworkflows en een volledige inventarisboomviewer. De bronrespons bevestigt momenteel geen stabiel voertuig-ID in de inventarislijst. Als een voertuigcode niet eenduidig naar een voertuig kan worden vertaald, blijft de voertuig- en vectorkoppeling onbekend.
