---
id: task-02
title: Idempotente FirePlan-radio-import en taakbediening
status: done
complexity: high
blocked-by: task-01
---
## Goal
Synchroniseer bevestigde FirePlan QR-radio's op bron-ID via de bestaande Celery- en taakrapportage-infrastructuur.

## Context
Hergebruik `fetch_inventory_qr_codes`, de bestaande sessie/client, QR URL-validatie en taakresultaat-/SSE-patronen. FirePlan blijft uitsluitend een leesbron.

## Acceptance Criteria
- [x] Gepagineerde records van de bevestigde namen worden volledig opgehaald voordat lokale radio's worden gewijzigd.
- [x] FirePlan-ID is de primaire matchsleutel; TEI wordt exact als tekst overgenomen, het model uit TEI-bereiken afgeleid en de volledige QR-URL bewaard.
- [x] `Radio mobile Astrid` wordt voertuiggebonden en `Radio portable Astrid` draagbaar; niet-waargenomen typen worden niet stilzwijgend geïmporteerd.
- [x] Ontbrekende/ongeldige ID, TEI of QR-URL en conflicten worden veilig per record gerapporteerd; credentials en volledige serienummers komen niet in logs.
- [x] Herhaalde synchronisatie is idempotent en verwijdert geen lokale radio zonder FirePlan-record.
- [x] Staff-only start-API en de bestaande taakdetail/SSE-pagina tonen voortgang en resultaat via de bestaande Celery/task-result infrastructuur.
- [x] Tests dekken success, unchanged, source-key conflict, invalid values, FirePlan failure, idempotence en permissies; er is geen FirePlan-write-operatie.

## Notes
- Added ID-first upsert synchronization for the two live-confirmed source names, retaining QR URLs and local-only radios while reporting invalid/conflicting source rows without TEIs.
- Added staff start endpoint and `fireplan.sync_radios` Celery task using the existing session, task result, progress, and SSE routes; no FirePlan writes.
- Added the frontend start API and task label.
- Verification: 32 focused backend tests passed (one opt-in Redis test skipped); 5 frontend tests passed; Ruff, Django system checks, migration drift check, and diff check passed.
