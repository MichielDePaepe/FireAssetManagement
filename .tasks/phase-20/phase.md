---
phase: 20
title: FirePlan-contract en mapping
status: closed
opened: 2026-11-21
closed: 2026-11-21
---
## Goal
Verifieer de actuele FirePlan-inventarisrespons en bouw een beperkte YAML-mapping voor selectieve extractie van draagbare radio's.

## Exit Criteria
- De gepagineerde lijst, `updatedAt`, `closedAt`, `vehicleAlphaCode`, containerboom en itemlijst zijn gevalideerd tegen FirePlan.
- De mapping selecteert `Cabine de conduite` en `itemTypeId: 1010` voor `Radio portable Astrid`; inventarisspecifieke container-UUID's worden tijdens verwerking opgezocht.
- Datumwaarden zonder tijdzone worden als Europe/Brussels geïnterpreteerd.
- De wijzigingssemantiek van `updatedAt` is bevestigd voordat deze voor automatische detailverwerking wordt gebruikt; bij gebrek aan bevestiging is de beperking vastgelegd en worden niet alle details elk uur gedownload.
- De YAML-parserdependency is expliciet gekozen en gedocumenteerd als er geen bestaande directe dependency geschikt is.

## Tasks
- [x] task-01-validate-fireplan-inventory-contract.md
- [x] task-02-yaml-radio-mapping-and-date-parsing.md

## Execution Notes
- Live FirePlan contract verified read-only; `updatedAt` edit semantics remain unconfirmed and are carried to phase 21 as a sync constraint.
- Backend: 166 passed, 1 skipped (live Redis broker required); Ruff passed. Frontend: 83 passed; ESLint and TypeScript passed.
