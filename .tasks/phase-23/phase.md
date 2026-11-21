---
phase: 23
title: Verificatie en documentatie
status: pending
opened: ~
closed: ~
---
## Goal
Verifieer de inventaris-API, idempotente opslag, historische koppeling, taakfouten en beheerdersflow; werk product- en architectuurdocumentatie bij.

## Carry from phase 22
1. Verify the summary-only staff API and inclusive manual period flow against phase 22's tests and current task interface; preserve the existing Celery/SSE result handling.

## Open follow-ups from phase 22
- FirePlan `updatedAt` semantics for edits to closed inventories remain unconfirmed. Keep manual period processing as the supported refresh path and retain the no-full-detail-scan limitation.

## Exit Criteria
- Backendchecks dekken FirePlan-paginering, mapping, datumparsing, nieuwe en gewijzigde inventarissen, periodeherverwerking, fouten en ontbrekende historiek.
- Frontendchecks dekken laden, lege en foutstatus, niet-gesynchroniseerde records, datumvalidatie, taakvoortgang en resultaat.
- Python-lint, frontend-lint en TypeScript-controles zijn uitgevoerd; ontbrekende services of tools zijn gerapporteerd.
- `SPEC.md`, `ARCHITECTURE.md`, `README.md` en waar nodig `.env.example` beschrijven het geïmplementeerde gedrag en de beperkingen.

## Tasks
