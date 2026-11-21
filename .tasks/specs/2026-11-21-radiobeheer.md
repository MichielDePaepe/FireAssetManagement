---
kind: extension
date: 2026-11-21
phases:
  - name: Radiodomein en relatiehistoriek
    goal: Voeg radio's, TEI-modelbereiken, organisaties, zelfstandige ISSI-records en historisch traceerbare abonnementen toe aan het bestaande assetdomein.
    exit-criteria: |
      - Een radio is een fysiek asset met een unieke TEI als tekst, optioneel merk/model, toepassingsvorm en FirePlan-identiteit/QR-URL.
      - Radiomodellen en niet-overlappende TEI-bereiken zijn beheerde referentiegegevens; een radio met een TEI zonder match kan geregistreerd blijven met onbekend model.
      - Een ISSI-record heeft een unieke tekstuele ISSI, alias en optionele organisatie. ISSI's en radio's kunnen onafhankelijk bestaan.
      - Een abonnement bewaart radio-ISSI-koppelingen met begin- en eindtijd; gedeeltelijke unieke beperkingen laten maximaal één actieve ISSI per radio en maximaal één actieve radio per ISSI toe.
      - Het vervangen van een bevestigde actieve koppeling beëindigt de vorige historische rij en maakt een nieuwe; er zijn geen aanvraag- of overdrachtsstatussen.
      - Bestaande ManagedRelationship-historiek kan ook een locatie als relatiebestemming bewaren zonder PhysicalLocationObservation te hergebruiken of bestaande pager-, vector- en voertuiggegevens te verliezen.
      - Plaatsing en operationele toewijzing blijven afzonderlijke betekenissen; draagbare radio's kunnen aan vectoren worden toegewezen, voertuiggebonden radio's aan voertuigen worden gemonteerd en vaste radio's aan locaties worden geïnstalleerd.
  - name: FirePlan-synchronisatie en radio-identificatie
    goal: Hergebruik de FirePlan QR-inventarisroute en bestaande task/SSE-infrastructuur voor radiosynchronisatie, en hergebruik de scannerbediening voor radiozoekopdrachten.
    exit-criteria: |
      - De huidige FirePlan QR-respons en beschikbare radiotypen worden tegen de bereikbare FirePlan-omgeving gevalideerd; de integratie gebruikt alleen bevestigde velden en meldt eventuele afwijkingen expliciet.
      - De synchronisatie leest gepagineerde FirePlan QR-records via de bestaande sessie en clientpatronen, gebruikt een als stabiel bevestigde FirePlan-ID als primaire bronmatchsleutel en bewaart de volledige QR-URL voor scanlookup.
      - Kandidaten worden op de bevestigde radiomodelnamen geselecteerd; TEI wordt uit het bevestigde serienummerveld gelezen en aan een lokaal radiomodel gekoppeld via de ingestelde TEI-bereiken.
      - Synchronisatie hergebruikt Celery, de bestaande task-ID, django-celery-results, celery-progress, SSE en taakrapportage; er ontstaat geen parallel taak- of resultaatmodel.
      - Herhaalde synchronisatie is idempotent, lokale radio's zonder FirePlan-record blijven behouden, en records met ongeldige/ontbrekende TEI, FirePlan-ID of QR-URL worden veilig gerapporteerd.
      - Authenticated scanlookup hergebruikt de QR-candidate normalisatie en scannerervaring voor camera en toetsenbordscanner; scannen identificeert een radio en verandert geen abonnement of plaatsing.
      - De FirePlan-integratie schrijft geen gegevens naar FirePlan en maakt daar geen nieuwe radio's aan.
  - name: Radio-, ISSI- en abonnementenbeheer
    goal: Bied een toegankelijke interface en API voor radio's, ISSI's, organisaties, modelbereiken, abonnementen en plaatsingen met de bestaande FAM-patronen.
    exit-criteria: |
      - Een navigatie-item Radio's staat direct onder Pagers en opent een module met Radio's-, ISSI's- en Abonnementenweergaven.
      - De radio-overzichtslijst ondersteunt zoeken op TEI, merk/model, FirePlan-gegevens en actuele koppelingen; ISSI's zijn vindbaar op nummer, alias, organisatie en gekoppelde radio.
      - Bevoegde gebruikers kunnen radio's, ISSI's en organisaties beheren; staff kan radiosynchronisatie starten en modellen/TEI-bereiken beheren.
      - Model/range- en organisatiebeheer is vanuit de module bereikbaar zonder TEI-bereiken hard te coderen of nieuwe frontend/backend-frameworks toe te voegen.
      - De abonnementenweergave toont actieve en beëindigde koppelingen met start- en eindtijd. Radio- en ISSI-detailweergaven maken de relevante huidige koppeling en historiek toegankelijk.
      - De bestaande assetrelatie-interface beheert radiospecifieke toewijzing/montage/installatie naar vector, voertuig of locatie, en bewaart elke wijziging in dezelfde relatiehistoriek.
      - FirePlan-ID en QR-URL blijven bronbeheerd en niet handmatig overschrijfbaar; sync-voortgang en rapport zijn beschikbaar via de bestaande taakschermen.
      - Tabellen volgen de bestaande vaste tabelgeometrie, sorteer- en filterpatronen, en bedieningselementen hebben toegankelijke labels/states en toetsenbordondersteuning.
  - name: Documentatie en verificatie
    goal: Werk de projectdocumentatie bij en verifieer dat het radiodomein, bronintegratie, historie en beheerinterface passen binnen de vastgelegde architectuur.
    exit-criteria: |
      - SPEC.md en ARCHITECTURE.md beschrijven radio's, ISSI's, abonnementshistoriek, TEI-bereiken, plaatsing en FirePlan-eigenaarschap correct; README beschrijft gebruikersgedrag en eventuele configuratie.
      - Backendtests dekken migratiebehoud, TEI-validatie/range-overlap, unieke actieve abonnementen aan beide kanten, transacties, geschiedenis, bronmatching, idempotentie, foutafhandeling, scanlookup en toegangsrechten.
      - Frontendtests dekken tabnavigatie, zoeken, beheren, QR-scannen, plaatsingen, abonnementshistoriek en laad-, lege- en fouttoestanden.
      - Backend pytest en frontend Vitest, Python lint, frontend ESLint en TypeScript-controles worden uitgevoerd; niet-uitgevoerde controles worden met reden gerapporteerd.
      - Er zijn geen nieuwe dependencies, FirePlan-schrijfoperaties, overdrachtsworkflow, inventariscontrole, afwijkingsdetectie, incidentenbeheer of operationele workflow in deze uitbreiding.
---
## Notes

### Doel en gekozen aanpak

Breid FAM uit met beheer van ASTRID/TETRA-radio's die naast pagers, voertuigen, vectoren en locaties in hetzelfde assetbeheer passen. De gekozen aanpak is uitbreiding van het bestaande generieke asset- en relatiepatroon. Er worden geen aparte radio-toewijzings-, historie-, task- of eventframeworks geïntroduceerd.

De bestaande `ManagedObject` heeft nu typen voor pager, voertuig en vector. Pagers staan in een eigen typegebonden assettabel. `ManagedRelationship` bewaart historische assetrelaties en laat één actieve `assigned_to`-relatie per bronasset toe; `PhysicalLocationObservation` heeft bewust de andere betekenis van een waargenomen fysieke plaats. `Location` is apart van `ManagedObject`. De radio-uitbreiding voegt een getypeerd radio-asset toe en breidt de bestaande relatiehistoriek uit met locatiebestemmingen. Een plaatsing of operationele toewijzing is geen locatieobservatie.

Alternatieven waren een afzonderlijke radio-administratie (dubbele historie- en toewijzingslogica) en radio's als generieke/ongetypeerde assetrecords (minder duidelijke validatie en beheer van radiovelden). De bestaande typegebonden asset- en historiepatronen zijn de aanbevolen en gekozen oplossing.

### Radio's, TEI en modellen

Een radio is een fysiek toestel met een unieke TEI. Bewaar de TEI als tekst om voorloopnullen te behouden. ETSI EN 300 392-1 V1.6.1 beschrijft de TEI als 15 hexadecimale tekens, bestaande uit TAC, FAC, ESN en een reserveveld. De RAM-referentie beschrijft een 15-cijferige numerieke invoer; de norm en actuele FirePlan-serialNumber-respons moeten daarom leidend zijn voor de uiteindelijke veldvalidatie. De beschikbare FirePlan-omgeving moet bij uitvoering bevestigen hoe TEI's in QR-inventarisrecords werkelijk worden weergegeven. Gebruik geen numerieke opslag die voorloopnullen of hexadecimale tekens verliest.

Een radiomodel bevat merk, modelnaam en de toepassingsvorm voor draagbaar, voertuiggebonden of vaste installatie. Een configureerbare TEI-bereikreferentie koppelt inclusief minimum en maximum aan een model. Bereikoverlap is verboden. Leg geen modelbereiken of modelnamen hard vast voordat een gezaghebbende bron ze bevestigt. Onbekende TEI-bereiken verhinderen registratie of import niet; het model blijft dan onbekend totdat de referentiegegevens worden aangevuld.

### ISSI, organisatie en abonnementshistoriek

Een ISSI is een zelfstandige netwerkabonnee-identiteit en niet een attribuut van een fysieke radio. ETSI TS 100 392-1 onderscheidt de korte SSI/ISSI-identiteit van de volledige ITSI waarin ook de netwerkidentiteit voorkomt. Bewaar het ISSI-nummer als unieke tekstwaarde; alias en optionele organisatie horen bij het ISSI-record. Er is in FAM nog geen organisatie-register, dus deze extensie voegt een beperkte beheerbare organisatie-entiteit toe. Implementeer geen afgeleide organisatiebereiken of importregels zonder bevestigde ASTRID-brondata.

Een historisch abonnement koppelt één radio aan één ISSI. Unieke databasebeperkingen staan maximaal één actuele ISSI per radio en maximaal één actuele radio per ISSI toe. Radio's zonder ISSI en ISSI's zonder radio zijn geldig. Een bevestigde koppelingwijziging sluit de vorige rij met eindtijd en maakt een nieuwe rij met starttijd. Er worden geen aanvragen, voorbereidingen, overdrachtsstatussen of externe bevestigingsprocessen gemodelleerd. De beheerder wijzigt de actuele relatie pas wanneer ASTRID de overdracht heeft bevestigd.

### Plaatsing en assetrelaties

Hergebruik `ManagedRelationship` en zijn start-/eindtijden. Draagbare radio's kunnen operationeel aan een vector worden toegewezen; het huidige voertuig voor die vector blijft door CityGIS bepaald. Een voertuiggebonden radio kan aan het voertuig worden gemonteerd. Een vaste radio kan aan een bestaande post, gebouw, kamer of andere locatie worden geïnstalleerd. Houd de relatiebestemming getypeerd zodat bestaande vector-/voertuigrelaties behouden blijven en locatie-installaties traceerbaar zijn.

De huidige generieke relatie verwijst alleen naar `ManagedObject`; de locatiebestemming vraagt een schema-uitbreiding met een exclusieve object- of locatiebestemming en consistente historische mutaties. Houd de semantiek van `assigned_to`, `mounted_in` en `installed_in` apart. De bestaande `PhysicalLocationObservation` blijft gereserveerd voor waarnemingen van aangetroffen locaties. Dit model legt de basis voor latere inventariscontroles, maar implementeert die niet.

### FirePlan, synchronisatie en QR

FAM gebruikt voor pagers de aangemelde FirePlan-sessie en de leesroute `fr/api/inventory/qr-codes`. De huidige client vraagt gepagineerde records op met `id`, `name`, `serialNumber` en `qrCode`, in pagina's van maximaal 500. De pager-import matcht initieel op serienummer en daarna op FirePlan-ID, bewaart de volledige QR-URL, laat lokale assets zonder bronrecord staan en loopt als bestaande Celery-taak met voortgang en rapport.

De huidige code bevat daarnaast een aparte leesintegratie voor afgesloten FirePlan-inventarissen. Die haalt Radio portable Astrid-items (waargenomen itemtype-ID 1010 in de bestaande mapping) uit geselecteerde inventarisdetails. Dit zijn observaties uit afgesloten inventarissen en geen volledige radio-masterlijst. Gebruik voor radiosynchronisatie het bestaande QR-inventarispatroon, niet de inventarisobservatietabel als assetregister.

De RAM-referentie vermeldt QR-recordnamen `Radio mobile Astrid`, `Radio portable Astrid` en `Portable ATEX`, maar deze set, de actuele TEI-vulling van `serialNumber` en de betekenis/stabiliteit van `id` zijn niet extern gedocumenteerd en moeten live worden bevestigd. Valideer de volledige bronrespons voordat de import als definitief contract geldt. Gebruik de FirePlan-ID als primaire bronmatchsleutel als de actuele bron bevestigt dat deze stabiel en uniek is; gebruik anders alleen een door de bron bevestigde stabiele sleutel en documenteer de beperking. Bewaar ook de volledige QR-URL. De URL is voldoende om een opgeslagen QR-scan op te zoeken, maar is geen reden om een afzonderlijke stabiele bron-ID weg te laten.

Hergebruik de credentials, sessiecookies, clientbeveiliging, Celery, bestaande task-ID, `celery-progress`, `django-celery-results`, SSE, task detail en synchronisatierapportage. Radio-sync is idempotent en verwijdert geen lokale radio's die ontbreken in FirePlan. FirePlan is voor deze scope alleen een bron: er zijn geen API-write-aanroepen of nieuwe radio-aanmaakacties in FirePlan. De interne API heeft geen openbare contractdocumentatie; rapporteer verschillen tussen codeverwachting en live respons expliciet.

Hergebruik de bestaande FirePlan QR-scanlogica en `PagerScanControl`-ervaring voor camera- en toetsenbordscans. De backend identificeert een radio op basis van opgeslagen QR-URL-kandidaten, inclusief de bestaande scannerlayoutnormalisatie. Een scan identificeert en toont het asset; het wijzigt geen plaatsing of abonnement. Camera-scan behoudt de bestaande vereiste van HTTPS of localhost.

### Gebruikersinterface en rechten

Plaats **Radio's** direct onder **Pagers** in de hoofdnavigatie. Gebruik de bestaande pagertabel- en formulierenpatronen met drie beheertabbladen: Radio's, ISSI's en Abonnementen. De radio-overzichtslijst zoekt op TEI, merk/model, FirePlan-velden en actuele relatie; de ISSI-lijst zoekt op nummer, alias, organisatie en gekoppelde radio. De abonnementenweergave toont huidige en historische koppelingen met begin- en eindtijd.

Beheer model-/TEI-bereiken en organisaties vanuit de radiosmodule met compacte, toegankelijke beheeracties. Gebruik voor sorteerbare en filterbare tabellen de vaste kolomgeometrie, gedeelde headerstijl, toetsenbordbediening en ARIA-patronen uit de repository-instructies. QR-scan opent een radioresultaat. Beheer van plaatsingen hergebruikt de huidige inventory relationship UI waar mogelijk, met doelen voor vectoren, voertuigen en locaties. FirePlan synchroniseren en bronvelden beheren volgen de bestaande staff-/read-only patronen.

### Fasegrenzen en verificatie

Deze uitbreiding omvat uitsluitend lokale registratie en beheer, FirePlan-leessynchronisatie, QR-identificatie, actuele abonnementen met historie, organisatie/modelreferenties en assetplaatsingen. Buiten scope zijn FirePlan-schrijven, automatische registratie van aanvragen, voorbereidingen of overdrachten, het wijzigen van ISSI-naar-radio vóór bevestiging door ASTRID, fysieke inventarissessies, afwijkingsdetectie, incidentenbeheer en operationele workflows.

Werk `SPEC.md`, `ARCHITECTURE.md` en `README.md` bij zodat ze overeenstemmen met de uiteindelijke code en bronbeperkingen. Verifieer API-authenticatie/validatie, migratiebehoud, TEI- en bereikregels, gelijktijdige actieve abonnementen, historiek, idempotente synchronisatie en behoud bij FirePlan-fouten, QR-scanvarianten, plaatsingshistoriek en autorisaties. Verifieer de frontend voor radio/ISSI/abonnementbeheer, laad-, lege- en fouttoestanden, zoeken, sorteren, scannen en relaties. Voer de repositorychecks uit die in `AGENTS.md` staan en rapporteer wat niet kon draaien en waarom. Voeg geen dependencies toe; de bestaande React/Vite/TypeScript en Django/DRF/Celery/PostgreSQL/Redis/SSE-stack volstaat.

Bronnen voor de domeindefinities: [ETSI EN 300 392-1 V1.6.1 (TEI)](https://www.etsi.org/deliver/etsi_en/300300_300399/30039201/01.06.01_60/en_30039201v010601p.pdf) en [ETSI TS 100 392-1 V1.5.1 (subscriber identities)](https://www.etsi.org/deliver/etsi_ts/100300_100399/10039201/01.05.01_60/ts_10039201v010501p.pdf). De technische referentie `radio-model-en-fireplan-synchronisatie.md` is achtergrond uit RAM en geen verplichte FAM-architectuur.
