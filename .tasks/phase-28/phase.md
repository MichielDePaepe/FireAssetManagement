---
phase: 28
title: Radio-, ISSI- en abonnementenbeheer
status: open
opened: 2026-11-21
closed: ~
---
## Goal
Bied een toegankelijke interface en API voor radio's, ISSI's, organisaties, modelbereiken, abonnementen en plaatsingen met de bestaande FAM-patronen.

## Carry from phase 27
1. Integrate `RadioScanLookup` into the phase 28 Radio module; the component and authenticated endpoint are implemented and tested, but no page consumes it yet.
2. Keep the live-confirmed FirePlan source names restricted to `Radio mobile Astrid` and `Radio portable Astrid`; do not infer support for unobserved QR types.

## Open follow-ups from phase 27
- A repeated live FirePlan fetch returned identical IDs and payload immediately, but long-term ID stability was not independently established.
- The live Redis/Celery integration test remains opt-in and was skipped in focused tests; run it during final verification if available.

## Exit Criteria
- Een navigatie-item Radio's staat direct onder Pagers en opent een module met Radio's-, ISSI's- en Abonnementenweergaven.
- De radio-overzichtslijst ondersteunt zoeken op TEI, merk/model, FirePlan-gegevens en actuele koppelingen; ISSI's zijn vindbaar op nummer, alias, organisatie en gekoppelde radio.
- Bevoegde gebruikers kunnen radio's, ISSI's en organisaties beheren; staff kan radiosynchronisatie starten en modellen/TEI-bereiken beheren.
- Model/range- en organisatiebeheer is vanuit de module bereikbaar zonder TEI-bereiken hard te coderen of nieuwe frontend/backend-frameworks toe te voegen.
- De abonnementenweergave toont actieve en beëindigde koppelingen met start- en eindtijd. Radio- en ISSI-detailweergaven maken de relevante huidige koppeling en historiek toegankelijk.
- De bestaande assetrelatie-interface beheert radiospecifieke toewijzing/montage/installatie naar vector, voertuig of locatie, en bewaart elke wijziging in dezelfde relatiehistoriek.
- FirePlan-ID en QR-URL blijven bronbeheerd en niet handmatig overschrijfbaar; sync-voortgang en rapport zijn beschikbaar via de bestaande taakschermen.
- Tabellen volgen de bestaande vaste tabelgeometrie, sorteer- en filterpatronen, en bedieningselementen hebben toegankelijke labels/states en toetsenbordondersteuning.

## Tasks
