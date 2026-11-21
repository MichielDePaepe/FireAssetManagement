---
id: task-03
title: Locatiebestemmingen in assetrelatiehistoriek
status: done
complexity: high
blocked-by: task-01
---
## Goal
Breid `ManagedRelationship` uit zodat een historische relatie getypeerd kan eindigen bij een asset of een fysieke `Location`.

## Context
Gebruik bestaande relatiehistoriek voor operationele toewijzing, montage en installatie. `PhysicalLocationObservation` blijft een afzonderlijke waarneming. Radiospecifieke relatievalidatie moet portable radio-toewijzing aan vectoren, voertuigradio-montage en vaste radio-installatie aan locaties ondersteunen.

## Acceptance Criteria
- [x] Relaties hebben precies één bestemming: `ManagedObject` of `Location`; de database bewaakt de exclusiviteit.
- [x] Semantiek van `assigned_to`, `mounted_in` en `installed_in` is afzonderlijk valideerbaar voor radio's en hun toegestane doelen.
- [x] Vervangen/sluiten van een relatie bewaart historie en ondersteunt locatiebestemmingen zonder `PhysicalLocationObservation` te wijzigen.
- [x] Bestaande pager-, vector- en voertuigrelaties en verwachte-locatie-afleiding blijven intact.
- [x] Migratie- en regressietests dekken bestaande relaties, locatiebestemmingen en ongeldige combinaties.

## Notes
- Added an exclusive asset-or-location relationship destination, PostgreSQL constraint, radio-specific target validation, and a history-preserving `relate` operation.
- Kept physical location observations separate and retained `assign_operationally` behavior for existing assets.
- Verification: 12 relationship/migration tests passed; Ruff, Django checks, migration drift check, and `git diff --check` passed.
