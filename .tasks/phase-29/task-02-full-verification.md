---
id: task-02
title: Radio-uitbreiding volledig verifiëren
status: done
complexity: high
blocked-by: task-01
---
## Goal
Voer de volledige backend- en frontendchecks uit, vul ontbrekende regressiedekking aan en rapporteer exact welke lokale integratiechecks konden draaien.

## Context
Volg AGENTS.md: pytest, Vitest, Python lint, ESLint en TypeScript. Voer de opt-in Redis/Celery-integratietest uit als de bestaande Compose-services dit toelaten. Verifieer de afwijkende radiosyncresultaten en de managed-object-ID plaatsingscontracten.

## Acceptance Criteria
- [x] Backendtests dekken Radio migraties, TEI-validatie/range-overlap, beide kanten van actieve abonnement-uniciteit, transacties/historie, bronmatching, idempotentie, fouten, scanlookup en permissions.
- [x] Frontendtests dekken module/navigatie, zoeken, CRUD, scanbediening, plaatsingshistorie/idempotentie, abonnementsdetail en loading/empty/error; radiosyncresultaat wordt correct getoond in voortgang, taakdetail, rapport en completion monitor.
- [x] Volledige backend pytest en frontend Vitest, Ruff, Django checks/migration drift, ESLint, TypeScript en frontend build zijn uitgevoerd.
- [x] Redis/Celery-integratietest is uitgevoerd als services beschikbaar zijn; anders wordt de concrete blocker vermeld.
- [x] Er zijn geen dependencies toegevoegd en geen FirePlan-schrijfoperaties, overdrachtsworkflow, inventariscontrole, afwijkingsdetectie, incidentenbeheer of operationele workflow geïntroduceerd.

## Notes
- `make test`: 259 backendtests and 117 frontendtests passed. Redis/Celery integration passed with the repository worker and beat briefly stopped so the test worker received the task. The run reported a test-database teardown warning because two sessions were still connected at teardown; no sessions remained afterward.
- `make lint`, `manage.py check`, `makemigrations --check --dry-run`, frontend build, ESLint and TypeScript passed. Ruff-required line wrapping was applied to five generated migrations; no migration operations changed.
- The app did not gain dependencies, configuration variables, FirePlan write operations, or excluded workflows.
- Browser runtime inspection could not run because the browser access host was unavailable.
- Live FirePlan-ID stability beyond an immediate repeated fetch remains unverified and is documented as a limitation.
