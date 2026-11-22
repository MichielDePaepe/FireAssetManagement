---
id: task-01
title: Radiodomein documenteren
status: done
complexity: medium
blocked-by: ~
---
## Goal
Werk SPEC.md, ARCHITECTURE.md en README bij zodat de radio-implementatie, FirePlan-eigenaarschap, plaatsingshistoriek en gebruikersbediening overeenkomen met de code.

## Context
Fase 26–28 introduceerde Radio, ISSI, RadioModel, TEI-bereiken, RadioSubscription, ManagedRelationship plaatsingen, FirePlan-sync en scanlookup. Behoud het generieke, configureerbare templatekarakter.

## Acceptance Criteria
- [x] SPEC.md en ARCHITECTURE.md beschrijven modellen, validatie, abonnementskoppelingen, histories, toepassingsgebonden plaatsingen en bronbeheerde FirePlan-identiteit.
- [x] README beschrijft radio-, ISSI-, abonnementen-, scan-, sync- en plaatsingsschermen en de bestaande toegangsrechten.
- [x] Documentatie noemt geen niet-bestaande FirePlan-velden, namen, of garanties; live-ID-stabiliteit wordt niet als bewezen beschreven.
- [x] Geen nieuwe environment-variabelen, dependencies of architectuurwijzigingen zijn nodig; documentatie blijft generiek voor templategebruikers.

## Notes
- Updated the template scope and added FR-040, API and data model architecture, radio synchronization limitations, and operator-facing radio workflows.
- No `.env.example` change was needed because radio features add no environment variables.
