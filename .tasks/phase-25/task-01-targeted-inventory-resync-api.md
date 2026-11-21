---
id: task-01
title: Gerichte hersynchronisatie via Celery
status: pending
complexity: high
blocked-by: ~
---
## Goal
Start vanuit een inventaris-UUID een geforceerde synchronisatie van alleen die inventaris met de bestaande taak- en voortgangsinfrastructuur.

## Context
De periode-endpoint staat in `backend/fireplan/views.py`; de bestaande Celery-taak is `fireplan.sync_inventories` in `backend/fireplan/tasks.py`. Hergebruik de task-ID, `celery-progress`, `django-celery-results`, SSE en de bestaande verwerking in `inventory_synchronization.py`.

## Acceptance Criteria
- [ ] Een staff-only endpoint accepteert één inventaris-UUID en start de bestaande Celery-taak met gerichte invoer.
- [ ] De taak haalt de gekozen inventaris opnieuw op, past de actuele mapping toe en herberekent voertuig/vector via `VectorVehicleHistory` op het inventaristijdstip.
- [ ] De taak synchroniseert geen andere inventarissen en rapporteert voortgang/resultaat via het bestaande taakformaat.
- [ ] Een volledig succesvolle verwerking vervangt metadata, relaties, JSON en observaties samen; een fout bewaart de volledige laatste succesvolle snapshot en registreert de fout.
- [ ] Backendtests dekken staff-validatie, alleen het gekozen UUID, succes, taakresultaat en foutbehoud.

## Notes
