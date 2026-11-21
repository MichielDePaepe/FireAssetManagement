---
id: task-01
title: Radio-identiteit en configureerbare TEI-modelbereiken
status: done
complexity: high
blocked-by: ~
---
## Goal
Voeg een getypeerd radio-asset toe met TEI als unieke tekst, FirePlan-bronvelden en beheerde modellen met niet-overlappende TEI-bereiken.

## Context
Herbruik `inventory.ManagedObject` en de typegebonden assetpatronen. De FirePlan-masterlijst en serialNumber-contract zijn nog niet live bevestigd; modelherkenning mag daarom onbekend blijven en mag geen hardgecodeerde modellen gebruiken.

## Acceptance Criteria
- [x] `ManagedObject.Kind` en een getypeerd radiomodel ondersteunen radios en behouden bestaande pager-, vector- en voertuigrecords.
- [x] Een radio heeft unieke TEI-tekst, optioneel model, toepassingstype, optioneel unieke FirePlan-ID en volledige QR-URL; bronvelden zijn als velden herkenbaar.
- [x] Configureerbare radiomodellen en inclusieve TEI-bereiken valideren grenzen en blokkeren overlappende ranges, ook bij gelijktijdige wijzigingen.
- [x] Een geldige TEI zonder passend bereik blijft registreerbaar met onbekend model; leading zeroes en toegestane hex-tekens blijven behouden.
- [x] Migraties, validatie en relevante API/modeltests dekken de nieuwe records en bestaande data blijft behouden.

## Notes
- Added typed `Radio`, `RadioModel`, and `TeiRange` records and `ManagedObject.Kind.RADIO`; migrations are additive.
- TEI values stay 15-character hexadecimal text; unset models are matched from inclusive, configurable ranges. Range writes serialize with a PostgreSQL transaction advisory lock.
- Verification: 7 targeted model and existing managed-object tests passed; Ruff, Django checks, and migration drift check passed.
