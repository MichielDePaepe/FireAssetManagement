---
phase: 29
title: Documentatie en verificatie
status: closed
opened: 2026-11-21
closed: 2026-11-21
---
## Goal
Werk de projectdocumentatie bij en verifieer dat het radiodomein, bronintegratie, historie en beheerinterface passen binnen de vastgelegde architectuur.

## Carry from phase 28
1. Document and verify the `fireplan.sync_radios` result schema across task progress, persisted result reporting, and the completion monitor; it is distinct from pager sync and includes skipped source rows.
2. Preserve the radio placement contract: selected vector/vehicle targets use their `managed_object.id`, fixed radios use a CityGIS location ID, and identical assignments remain idempotent.

## Open follow-ups from phase 28
- Live FirePlan IDs were identical in an immediate repeat only; longer-term ID stability is not independently proven.
- The live Redis/Celery integration test remained opt-in and skipped earlier; run it in final verification if the configured services are available.

## Exit Criteria
- SPEC.md en ARCHITECTURE.md beschrijven radio's, ISSI's, abonnementshistoriek, TEI-bereiken, plaatsing en FirePlan-eigenaarschap correct; README beschrijft gebruikersgedrag en eventuele configuratie.
- Backendtests dekken migratiebehoud, TEI-validatie/range-overlap, unieke actieve abonnementen aan beide kanten, transacties, geschiedenis, bronmatching, idempotentie, foutafhandeling, scanlookup en toegangsrechten.
- Frontendtests dekken tabnavigatie, zoeken, beheren, QR-scannen, plaatsingen, abonnementshistoriek en laad-, lege- en fouttoestanden.
- Backend pytest en frontend Vitest, Python lint, frontend ESLint en TypeScript-controles worden uitgevoerd; niet-uitgevoerde controles worden met reden gerapporteerd.
- Er zijn geen nieuwe dependencies, FirePlan-schrijfoperaties, overdrachtsworkflow, inventariscontrole, afwijkingsdetectie, incidentenbeheer of operationele workflow in deze uitbreiding.

## Tasks
- [x] task-01-radio-domain-documentation.md
- [x] task-02-full-verification.md

## Carry-forward
- Live FirePlan ID stability beyond an immediate repeated fetch remains unverified; retain this qualification wherever the source matching behavior is described.
- No other open follow-ups remain from this extension.
