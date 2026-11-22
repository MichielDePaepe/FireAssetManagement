---
phase: 30
title: Postenoverzicht op het dashboard
status: closed
opened: 2026-11-22
closed: 2026-11-22
---
## Goal
Vervang het generieke dashboard door een alleen-lezen, actueel overzicht van posten en hun CityGIS-vectoren, gegroepeerd volgens de goedgekeurde status- en vectortyperegels.

## Exit Criteria
- Het dashboard toont alle posten en hun actuele vectoren met status, voertuigcode, vectorcode en beschikbaarheidstotalen volgens de goedgekeurde spec.
- Statushistoriek opent via de bestaande CityGIS-historiekinterface.
- De bestaande API-, SSE- en permissiepaden worden hergebruikt; er komen geen backendendpoint, migratie, dependency of schrijfoperatie bij.
- De afgesproken indeling, volgorde, limieten per cel en uitklapbediening zijn geïmplementeerd.

## Tasks
- [x] task-01-vector-grouping-and-order.md
- [x] task-02-live-dashboard-and-history.md

## Carry-forward

### Carry from phase 30
1. Keep the grouping behavior in `frontend/src/lib/dashboardGrouping.ts`; the CityGIS API supplies the nested `vector.post` mapping used by the dashboard.
2. Extend behavior tests for two-digit and unknown status display, empty/error states, and post mapping; current focused tests cover core grouping, initial display, expansion, history click and SSE updates.

### Open follow-ups from phase 30
- Run full project verification and update dashboard documentation in phase 31.
