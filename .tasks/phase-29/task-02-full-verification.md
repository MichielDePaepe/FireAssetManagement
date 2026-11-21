---
id: task-02
title: Radio-uitbreiding volledig verifiëren
status: pending
complexity: high
blocked-by: task-01
---
## Goal
Voer de volledige backend- en frontendchecks uit, vul ontbrekende regressiedekking aan en rapporteer exact welke lokale integratiechecks konden draaien.

## Context
Volg AGENTS.md: pytest, Vitest, Python lint, ESLint en TypeScript. Voer de opt-in Redis/Celery-integratietest uit als de bestaande Compose-services dit toelaten. Verifieer de afwijkende radiosyncresultaten en de managed-object-ID plaatsingscontracten.

## Acceptance Criteria
- [ ] Backendtests dekken Radio migraties, TEI-validatie/range-overlap, beide kanten van actieve abonnement-uniciteit, transacties/historie, bronmatching, idempotentie, fouten, scanlookup en permissions.
- [ ] Frontendtests dekken module/navigatie, zoeken, CRUD, scanbediening, plaatsingshistorie/idempotentie, abonnementsdetail en loading/empty/error; radiosyncresultaat wordt correct getoond in voortgang, taakdetail, rapport en completion monitor.
- [ ] Volledige backend pytest en frontend Vitest, Ruff, Django checks/migration drift, ESLint, TypeScript en frontend build zijn uitgevoerd.
- [ ] Redis/Celery-integratietest is uitgevoerd als services beschikbaar zijn; anders wordt de concrete blocker vermeld.
- [ ] Er zijn geen dependencies toegevoegd en geen FirePlan-schrijfoperaties, overdrachtsworkflow, inventariscontrole, afwijkingsdetectie, incidentenbeheer of operationele workflow geïntroduceerd.

## Notes
- Live FirePlan-ID-stabiliteit op langere termijn is niet onafhankelijk bevestigd; documenteer dit als beperking in plaats van het te claimen.
