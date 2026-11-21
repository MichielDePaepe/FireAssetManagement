---
phase: 21
title: Opslag en Celery-synchronisatie
status: pending
opened: ~
closed: ~
---
## Goal
Bewaar inventarissen en hun relevante radioresultaten idempotent en synchroniseer ze via de bestaande Celery-infrastructuur.

## Exit Criteria
- Inventaris-UUID's en inventaris-item-ID's zijn uniek; relevante radioresultaten bestaan zowel als beperkte JSON-brondata als gestructureerde TEI-observaties.
- Upserts passen de actuele mapping opnieuw toe; succesvolle herverwerking vervangt de observaties atomair en fouten bewaren de laatste succesvolle data.
- Synchronisatie verwerkt nieuwe en bevestigde gewijzigde inventarissen periodiek via Celery Beat en ondersteunt geforceerde herverwerking van een inclusieve periode.
- De voertuigkoppeling gebruikt een eenduidige `vehicleAlphaCode`-match; de vectorkoppeling wordt per inventaristijdstip gereconstrueerd via de bestaande `VectorVehicleHistory`-waarnemingsintervallen.
- De circa één minuut waarnemingsafwijking is aanvaardbaar; zonder passende historie blijft de vector onbekend. Hersynchronisatie berekent de koppeling opnieuw.
- Voortgang, taak-ID en resultaat gebruiken Celery, `celery-progress`, `django-celery-results` en de bestaande SSE-flow.

## Tasks
