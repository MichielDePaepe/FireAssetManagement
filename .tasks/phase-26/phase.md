---
phase: 26
title: Radiodomein en relatiehistoriek
status: closed
opened: 2026-11-21
closed: 2026-11-21
---
## Goal
Voeg radio's, TEI-modelbereiken, organisaties, zelfstandige ISSI-records en historisch traceerbare abonnementen toe aan het bestaande assetdomein.

## Carry from phase 25
- None.

## Open follow-ups from phase 25
- The live Redis broker integration test remains unrun; run it when a live test broker is available.

## Exit Criteria
- Een radio is een fysiek asset met een unieke TEI als tekst, optioneel merk/model, toepassingsvorm en FirePlan-identiteit/QR-URL.
- Radiomodellen en niet-overlappende TEI-bereiken zijn beheerde referentiegegevens; een radio met een TEI zonder match kan geregistreerd blijven met onbekend model.
- Een ISSI-record heeft een unieke tekstuele ISSI, alias en optionele organisatie. ISSI's en radio's kunnen onafhankelijk bestaan.
- Een abonnement bewaart radio-ISSI-koppelingen met begin- en eindtijd; gedeeltelijke unieke beperkingen laten maximaal één actieve ISSI per radio en maximaal één actieve radio per ISSI toe.
- Het vervangen van een bevestigde actieve koppeling beëindigt de vorige historische rij en maakt een nieuwe; er zijn geen aanvraag- of overdrachtsstatussen.
- Bestaande ManagedRelationship-historiek kan ook een locatie als relatiebestemming bewaren zonder PhysicalLocationObservation te hergebruiken of bestaande pager-, vector- en voertuiggegevens te verliezen.
- Plaatsing en operationele toewijzing blijven afzonderlijke betekenissen; draagbare radio's kunnen aan vectoren worden toegewezen, voertuiggebonden radio's aan voertuigen worden gemonteerd en vaste radio's aan locaties worden geïnstalleerd.

## Tasks
- [x] task-01-radio-identity-and-model-ranges.md
- [x] task-02-issi-organizations-and-subscription-history.md
- [x] task-03-location-aware-managed-relationships.md

## Carry-forward

### Carry from phase 26
1. Validate live FirePlan QR records, stable source IDs, supported radio names, and serialNumber TEI representation before finalizing phase 27 import contracts; the local TEI model currently accepts 15 hexadecimal characters as text.

### Open follow-ups from phase 26
- The phase 25 live Redis broker integration test remains unrun; rerun if the broker is available during final verification.
