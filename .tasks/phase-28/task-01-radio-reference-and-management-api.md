---
id: task-01
title: Radio-, ISSI-, model- en organisatie-API
status: done
complexity: high
blocked-by: ~
---
## Goal
Bied typed API's voor radio's, ISSI's, organisaties, radiomodellen, TEI-bereiken en abonnementshistoriek.

## Context
Hergebruik de phase 26-modellen en FAM DRF-patronen. FirePlan-ID en QR URL blijven uitsluitend bronbeheerd. Alleen bevoegde staff mag configuratie en records muteren; ingelogde gebruikers kunnen ze lezen.

## Acceptance Criteria
- [x] CRUD-API's bestaan voor radio's, ISSI's, organisaties, modellen en TEI-bereiken; schrijfpermissies zijn staff-only.
- [x] Radiozoekopdrachten ondersteunen TEI, fabrikant/model, FirePlan-identiteit en actuele ISSI; ISSI-zoekopdrachten ondersteunen nummer, alias, organisatie en radio.
- [x] Radio- en ISSI-detailpayloads bevatten de huidige koppeling en chronologische volledige abonnementshistoriek.
- [x] Een bevestigde abonnementwijziging gebruikt `RadioSubscription.assign`; databasebeperkingen blijven de laatste bescherming.
- [x] FirePlan-ID/QR-URL zijn read-only; TEI, toepassing en model/range worden expliciet gevalideerd.
- [x] API-tests dekken validatie, zoekvelden, rechten, actieve en beëindigde histories en wijziging zonder overdrachtsstatussen.

## Notes
- Added staff-write/authenticated-read APIs for radios, ISSIs, organizations, radio models, TEI ranges, and subscription history/assignment.
- Added relation-aware search, nested current/history details, FirePlan source-field protection, and explicit range/application validation.
- Verification: 9 focused API tests passed; Ruff passed.
