---
id: task-02
title: Suivo-kopie en volledige Celery-sync
status: done
complexity: high
blocked-by: [task-01]
---
## Goal
Bewaar een idempotente actuele Suivo-kopie en bied een handmatige volledige sync via de bestaande Celery/task-progress-infrastructuur.

## Context
Gebruik de bestaande Django apps, `shared_task`, task IDs, django-celery-results, celery-progress en SSE. Behoud de laatst succesvolle snapshot wanneer ophalen of verwerken mislukt of gedeeltelijk is.

## Acceptance Criteria
- [ ] Suivo units, devices en beschikbare actuele status worden op stabiele bron-ID opgeslagen; verwijder ontbrekende upstream-records niet automatisch.
- [x] Een volledige sync werkt gegevens atomisch bij en houdt syncsucces/-fout en tijdstippen beschikbaar.
- [x] De bestaande Celery/progress/result/SSE-patronen worden gebruikt met begrensde retries en bestaande taaklimieten.
- [x] Tests dekken idempotentie, ontbrekende records, foutieve bron-ID's, behoud vorige kopie en staff-only taakstart.
- [x] Migratie en architectuurdocumentatie weerspiegelen de implementatie.

## Notes
- Added unit/device snapshot models, singleton sync state, atomic upserts and `suivo.sync` Celery task with progress, retries and safe error reporting.
- Added staff-only manual sync endpoint and included task in the existing task result/SSE list. Six focused tests pass.
