---
phase: 39
title: Accountvalidatie en documentatie
status: pending
opened: ~
closed: ~
---
## Goal
Verifieer de Suivo-contractgrenzen tegen de bereikbare account en documenteer de uiteindelijke velden, bediening en operationele randvoorwaarden.

## Exit Criteria
- De accountvalidatie bevestigt beschikbare device-types en of ongekoppelde devices status, positie of batterijgegevens leveren. UI en documentatie beloven alleen bevestigde velden.
- Matching is gecontroleerd voor geen, één en meerdere mogelijke voertuigmatches; onjuiste koppelingen worden niet stilzwijgend opgeslagen.
- README, `.env.example`, `SPEC.md` en `ARCHITECTURE.md` beschrijven integratie, OAuth-configuratie, push-consumer, dagelijkse reconciliatie, handmatige refresh, stale-data-gedrag en herstelbeperkingen.
- Backend pytest, frontend Vitest, Python lint, ESLint en TypeScript-checks zijn uitgevoerd wanneer diensten beschikbaar zijn; niet-uitvoerbare checks en oorzaken zijn gerapporteerd.
- Geen Suivo-writes, FAM-side verplaatsingen, abonnementsbeheer, historische positietracks of nieuwe map-/operationele workflows.

## Tasks
