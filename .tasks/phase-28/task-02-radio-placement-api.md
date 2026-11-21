---
id: task-02
title: Radiospecifieke plaatsings-API
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Laat bevoegde gebruikers radio's plaatsen via de bestaande `ManagedRelationship`-historiek met de juiste doelsoort per toepassing.

## Context
Gebruik de phase 26 `ManagedRelationship.relate`-operatie en het bestaande inventory/location catalogusgedrag. Een plaatsing is geen fysieke locatieobservatie.

## Acceptance Criteria
- [x] Een radio kan alleen worden toegewezen aan vector, gemonteerd in voertuig of geïnstalleerd op een bestaande locatie passend bij de toepassing.
- [x] Een wijziging sluit de bestaande relatie en bewaart begin/eindtijd; onveranderde doelen zijn idempotent.
- [x] API-response bevat huidige plaatsing en geschiedenis met getypeerde bestemming; ongeldig doel wordt afgewezen.
- [x] Bronbeheerde FirePlan-velden en `PhysicalLocationObservation` worden niet gewijzigd.
- [x] API-tests dekken toegangsrechten, elk doeltype, incompatibele doelen, vervanging en historische read-back.

## Notes
- Added staff-write/current-and-history API for radio placement, using `ManagedRelationship.relate` and history-preserving clear behavior.
- Enforced typed vector, vehicle, and location destinations by radio application; physical observations remain independent.
- Verification: 15 placement and relationship tests passed; Ruff, Django system checks, and migration drift check passed.
