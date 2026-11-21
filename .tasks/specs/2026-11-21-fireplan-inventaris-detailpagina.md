---
kind: extension
date: 2026-11-21
phases:
  - name: Lokale inventarisdetailpagina
    goal: Laat beheerders de laatst succesvol gesynchroniseerde FirePlan-inventarisgegevens en radioresultaten vanuit de inventarislijst openen.
    exit-criteria: |
      - Een inventaris met minstens één succesvolle synchronisatie opent vanuit Beheer → FirePlan-inventarissen een detailroute op basis van de inventaris-UUID.
      - Een record zonder succesvolle synchronisatie heeft geen actieve detailactie; een eerder succesvol record blijft openbaar als een latere poging faalde, met de foutstatus naast de laatste succesvolle snapshot.
      - Een staff-only detail-API retourneert alleen de lokaal opgeslagen FireplanInventory-snapshot en radio-observaties, zonder nieuwe FirePlan-aanvraag.
      - De overzichtstabel toont de overeenkomstige vector. Bij een gesynchroniseerde inventaris komt die uit de lokaal opgeslagen koppeling; bij een niet-gesynchroniseerde inventaris wordt ze bepaald via `VectorVehicleHistory` op het FirePlan-inventaristijdstip.
      - Voor een niet-gesynchroniseerde inventaris wordt de historische koppeling bepaald aan de hand van de voertuigcode en de bestaande waarnemingshistoriek. De periodieke CityGIS-synchronisatie en de mogelijke afwijking van ongeveer één minuut zijn voor deze toepassing voldoende; zonder historische gegevens blijft de vector onbekend.
      - De pagina toont de opgeslagen inventarismetadata, voertuig- en vectorrelatie als die bestaan, synchronisatiestatus en -tijd, de gevonden radio's met TEI/item-ID en de opgeslagen radio-JSON netjes geformatteerd.
      - Een ontbrekende voertuig- of vectorrelatie wordt als onbekend getoond; de detailweergave verzint geen koppeling en haalt geen volledige containerboom op.
  - name: Gerichte hersynchronisatie en afronding
    goal: Laat een beheerder vanaf de detailpagina uitsluitend de geselecteerde inventaris opnieuw ophalen en verwerken via de bestaande Celery-taakstroom.
    exit-criteria: |
      - Een sync-knop start geforceerde herverwerking van één inventaris-UUID, zonder andere inventarissen van dezelfde datum te synchroniseren.
      - De detailophaling gebruikt de actuele YAML-mapping en berekent de voertuig-vectorkoppeling opnieuw via de bestaande VectorVehicleHistory op het inventaristijdstip.
      - De taak gebruikt bestaande Celery-task-ID's, voortgang, resultaatopslag en SSE; er wordt geen parallel taakmechanisme toegevoegd.
      - Een volledige succesvolle verwerking vervangt metadata, voertuig- en vectorkoppeling, JSON en radio-observaties atomair. Bij een fout blijven alle onderdelen van de laatste succesvolle snapshot intact en wordt de fout zichtbaar.
      - Backend- en frontendchecks dekken staff-toegang, detaildata, ongesynchroniseerde en mislukte records, gerichte resync, voortgang en behoud van de vorige succesvolle snapshot.
      - `SPEC.md`, `ARCHITECTURE.md` en `README.md` beschrijven de detailweergave en gerichte hersynchronisatie; er komt geen nieuwe configuratievariabele.
---
## Notes

### Bestaande gegevens en bouwstenen

De beheerpagina staat op `/fireplan/inventories` en leest `GET /api/fireplan/inventories/` met gepagineerde FirePlan-samenvattingen en lokale synchronisatiestatus. De backend bewaart per inventaris de unieke FirePlan-UUID, bronmetadata, voertuig- en vectorrelatie, synchronisatiestatus, laatste fout, `last_successful_sync_at`, `radio_items` als beperkte JSON en aparte `FireplanRadioObservation`-records met item-ID en TEI. De lijst toont de vector uit de lokale koppeling zodra de inventaris succesvol is gesynchroniseerd. Voor records zonder succesvolle synchronisatie bepaalt de API de vector op basis van de voertuigcode en `VectorVehicleHistory` op het inventaristijdstip; ontbrekende historiek geeft een onbekende vector.

De huidige pagina toont samenvattingen als niet-klikbare rijen. Hergebruik de bestaande FirePlan-client, credentials, modellen, beheerdersroutes, task-monitoring, `celery-progress`, `django-celery-results` en SSE. Voeg geen aparte store, taakqueue of resultaatmodel toe.

### Detailweergave

Maak een staff-only detailendpoint voor een lokale `FireplanInventory` en zijn `radio_observations`. Gebruik de FirePlan-UUID in de route. Deze endpoint leest PostgreSQL en doet geen live FirePlan-opvraag: het doel is precies de snapshot te tonen die de synchronisatie heeft opgeslagen.

Maak in de overzichtslijst alleen records met `last_successful_sync_at` klikbaar. Gebruik de laatste succesvolle inhoud, ook wanneer `sync_status` inmiddels `failed` is na een latere mislukte poging; toon in dat geval de fout apart. Records zonder ooit geslaagde synchronisatie blijven niet-klikbaar.

Toon de bronmetadata die FAM al bewaart: voertuigcode, type, locatie/post, uitvoerder, toezichthouder, aanmaak-, afsluit- en wijzigingstijd, beschikbare statusvelden, synchronisatiestatus, laatste succesvolle tijd en eventuele fout. Toon de gekoppelde FAM-voertuig- en vectorgegevens wanneer beschikbaar en laat onbekende relaties expliciet onbekend.

Toon in de overzichtstabel de vector die bij de inventaris hoort. Gebruik voor een succesvol gesynchroniseerde inventaris de lokaal opgeslagen vectorkoppeling. Is de inventaris nog niet gesynchroniseerd, bepaal de vector dan via de bestaande `VectorVehicleHistory`, met de voertuigcode en het FirePlan-inventaristijdstip. CityGIS wordt elke minuut bijgewerkt; de mogelijke afwijking van ongeveer één minuut geldt als voldoende nauwkeurig. Voeg geen betrouwbaarheidsniveaus, onzekerheidsintervallen of extra reconstructielogica toe. Als er geen historische gegevens beschikbaar zijn, toon de vector als onbekend.

Toon de gestructureerde radio-observaties met TEI als tekst en FirePlan-item-ID. Toon daarnaast de bewaarde `radio_items` JSON netjes geformatteerd (indentatie en behoud van TEI-voorloopnullen). De JSON bevat alleen de radioresultaten uit de bestaande mapping, niet de volledige `Cabine de conduite`-lijst of inventarisboom.

### Eén inventaris opnieuw synchroniseren

De detailpagina bevat een knop om uitsluitend deze inventaris te herverwerken. De knop start een staff-only endpoint met de FirePlan-UUID en gebruikt de bestaande `fireplan.sync_inventories`-taak met een gerichte UUID-invoer of een gelijkwaardige uitbreiding van die taak; hergebruik de huidige task-ID-, voortgangs-, rapportage- en SSE-stroom. Synchroniseer niet alle inventarissen op dezelfde `closedAt`-datum.

Haal de brongegevens voor de geselecteerde UUID opnieuw op en pas de actuele YAML-mapping toe. Herbereken ook de voertuig-vectorkoppeling via de bestaande `VectorVehicleHistory` op het FirePlan-inventaristijdstip. Commit de nieuwe metadata, voertuig- en vectorkoppeling, JSON en observatieregels samen na een volledige succesvolle detailophaling en validatie. Bij een fout blijven alle gegevens van de vorige succesvolle snapshot behouden en wordt de nieuwe fout als laatste poging geregistreerd.

Na afloop blijft de detailpagina de bijgewerkte lokale snapshot tonen; gebruik de bestaande taakmonitor of taakdetailroute voor live voortgang en het bewaarde taakresultaat. De gewone historische datumactie op de overzichtspagina blijft ongewijzigd en kan meerdere inventarissen verwerken.

Buiten scope blijven: een live FirePlan-viewer, volledige containerboom, niet-gemapte containeritems, afwijkingsdetectie, verwachte-versus-vastgestelde vergelijking, een mappingeditor en een nieuw synchronisatieframework.
