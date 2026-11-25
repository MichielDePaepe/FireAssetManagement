---
phase: 39
title: Accountvalidatie en documentatie
status: closed
opened: 2026-11-25
closed: 2026-11-25
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
- [x] task-01-live-account-contract-and-match-verification.md
- [x] task-02-final-documentation-and-configuration.md
- [x] task-03-full-regression-and-closeout.md

## Carry from phase 38
- The push consumer and daily/manual full reconciliation are implemented; full backend and frontend regression checks passed, with the opt-in Redis integration test still skipped.
- Visual screenshot QA is still unavailable because the CUA/browser host could not be accessed.

## Open follow-ups from phase 38
- Optional Redis-broker Celery/SSE integration test requires explicit live-broker opt-in and remains unverified.
- Repeat browser screenshot QA if a CUA/browser host becomes available.

## Completion Notes
- The live account contract and exact-match behavior are documented with aggregate-only sample counts; current missing telemetry is shown as unavailable and does not imply subscription status.
- README, `.env.example`, `SPEC.md`, and `ARCHITECTURE.md` cover setup, the single consumer, daily and manual reconciliation, stale data, and recovery limits.
- Full backend and frontend suites plus lint, TypeScript, migration, Compose configuration, and diff checks passed. One optional Redis-broker integration test remains skipped because it requires explicit live-broker opt-in.
- Visual screenshot QA remains unverified because the browser host was unavailable; the UI component tests passed.
