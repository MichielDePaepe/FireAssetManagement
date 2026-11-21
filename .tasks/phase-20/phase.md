---
phase: 20
title: FirePlan-contract en mapping
status: pending
opened: ~
closed: ~
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
