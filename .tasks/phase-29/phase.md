---
phase: 29
title: Documentatie en verificatie
status: pending
opened: ~
closed: ~
---
## Goal
Werk de projectdocumentatie bij en verifieer dat het radiodomein, bronintegratie, historie en beheerinterface passen binnen de vastgelegde architectuur.

## Exit Criteria
- SPEC.md en ARCHITECTURE.md beschrijven radio's, ISSI's, abonnementshistoriek, TEI-bereiken, plaatsing en FirePlan-eigenaarschap correct; README beschrijft gebruikersgedrag en eventuele configuratie.
- Backendtests dekken migratiebehoud, TEI-validatie/range-overlap, unieke actieve abonnementen aan beide kanten, transacties, geschiedenis, bronmatching, idempotentie, foutafhandeling, scanlookup en toegangsrechten.
- Frontendtests dekken tabnavigatie, zoeken, beheren, QR-scannen, plaatsingen, abonnementshistoriek en laad-, lege- en fouttoestanden.
- Backend pytest en frontend Vitest, Python lint, frontend ESLint en TypeScript-controles worden uitgevoerd; niet-uitgevoerde controles worden met reden gerapporteerd.
- Er zijn geen nieuwe dependencies, FirePlan-schrijfoperaties, overdrachtsworkflow, inventariscontrole, afwijkingsdetectie, incidentenbeheer of operationele workflow in deze uitbreiding.

## Tasks
