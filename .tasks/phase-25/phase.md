---
phase: 25
title: Gerichte hersynchronisatie en afronding
status: open
opened: 2026-11-21
closed: ~
---
## Goal
Laat beheerders één FirePlan-inventaris opnieuw ophalen en verwerken via de bestaande Celery-taakstroom, met behoud van de succesvolle snapshot bij fouten.

## Carry from phase 24
1. None.

## Open follow-ups from phase 24
- One live Redis broker integration test remains unrun because the test broker was unavailable.

## Exit Criteria
- De detailpagina kan uitsluitend de geselecteerde inventaris opnieuw synchroniseren met bestaande voortgangs- en rapportagefunctionaliteit.
- Een succesvolle verwerking vervangt metadata, voertuig- en vectorkoppeling, JSON en observaties samen; bij een fout blijft de vorige succesvolle snapshot volledig behouden en wordt de fout geregistreerd.
- Backend- en frontendchecks, lint en TypeScript-controles dekken de gewijzigde flows; onbeschikbare services of tools worden gerapporteerd.
- `SPEC.md`, `ARCHITECTURE.md` en `README.md` beschrijven de detailpagina en gerichte hersynchronisatie.

## Tasks
