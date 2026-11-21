---
phase: 21
title: Opslag en Celery-synchronisatie
status: closed
opened: 2026-11-21
closed: 2026-11-21
---
## Goal
Bewaar inventarissen en hun relevante radioresultaten idempotent en synchroniseer ze via de bestaande Celery-infrastructuur.

## Carry from phase 20
1. Reuse the YAML mapping and Brussels-aware date parser; resolve the cabin UUID from each inventory tree. Because `updatedAt` has not been proven to change when closed inventory contents change, periodic sync must not fetch every detail tree hourly or claim reliable change detection from that field.

## Open follow-ups from phase 20
- Reassess `updatedAt` only if non-destructive before/after evidence becomes available; until then preserve the phase 20 limitation in synchronization behavior and documentation.

## Exit Criteria
- Inventaris-UUID's en inventaris-item-ID's zijn uniek; relevante radioresultaten bestaan zowel als beperkte JSON-brondata als gestructureerde TEI-observaties.
- Upserts passen de actuele mapping opnieuw toe; succesvolle herverwerking vervangt de observaties atomair en fouten bewaren de laatste succesvolle data.
- Synchronisatie verwerkt nieuwe en bevestigde gewijzigde inventarissen periodiek via Celery Beat en ondersteunt geforceerde herverwerking van een inclusieve periode.
- De voertuigkoppeling gebruikt een eenduidige `vehicleAlphaCode`-match; de vectorkoppeling wordt per inventaristijdstip gereconstrueerd via de bestaande `VectorVehicleHistory`-waarnemingsintervallen.
- De circa één minuut waarnemingsafwijking is aanvaardbaar; zonder passende historie blijft de vector onbekend. Hersynchronisatie berekent de koppeling opnieuw.
- Voortgang, taak-ID en resultaat gebruiken Celery, `celery-progress`, `django-celery-results` en de bestaande SSE-flow.

## Tasks
- [x] task-01-inventory-storage-and-history-links.md
- [x] task-02-inventory-fetch-and-idempotent-processing.md
- [x] task-03-celery-inventory-synchronization.md

## Execution Notes
- Backend suite: 188 passed, 1 skipped (requires live Redis broker); Ruff, Django system check, and migration drift check passed.
- Automatic sync fetches summaries hourly and only fetches details for new, failed, or mapping-version-stale inventories. Manual date periods force detail retrieval.
