---
id: task-02
title: ISSI-organisaties en abonnementshistoriek
status: done
complexity: high
blocked-by: task-01
---
## Goal
Voeg zelfstandige ISSI- en organisatiegegevens toe en implementeer historisch traceerbare radio-ISSI-abonnementen.

## Context
Een ISSI en een radio mogen onafhankelijk bestaan. Alleen bevestigde wijzigingen vervangen een actieve koppeling; er zijn geen aanvraag- of overdrachtsstatussen.

## Acceptance Criteria
- [x] Organisaties en ISSI-records hebben beheerbare velden; ISSI wordt als unieke tekst opgeslagen en kan zonder radio bestaan.
- [x] Abonnementshistoriek bewaart start- en eindtijd en databasebeperkingen staan maximaal één actief abonnement per radio en per ISSI toe.
- [x] Een transactionele vervanging sluit de vorige rij en maakt één nieuwe actieve rij; herhaling van dezelfde koppeling verandert historiek niet.
- [x] Uniciteits-, concurrency, onafhankelijk-bestaan- en historietests slagen.

## Notes
- Added independent organization and ISSI records plus partial unique constraints for active radio/ISSI subscriptions.
- `RadioSubscription.assign` locks both identities, closes conflicting active history on either side, and is idempotent for an unchanged pair.
- Verification: 3 focused subscription tests, Ruff, and migration drift check passed.
