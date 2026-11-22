---
phase: 31
title: Dashboardverificatie en documentatie
status: pending
opened: ~
closed: ~
---
## Goal
Controleer het nieuwe dashboardgedrag, voer de beschikbare projectchecks uit en werk documentatie bij waar die het dashboard onjuist beschrijft.

## Exit Criteria
- Frontendtests dekken groepering, status- en typegrenzen, prioriteitsvolgorde, totalen, uitklappen, onbekende status en het openen van statusgeschiedenis.
- Frontendtests dekken laden, lege resultaten, fouten, SSE-updates en verouderde data bij een verbroken verbinding.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint en TypeScript-controles zijn uitgevoerd waar de vereiste services beschikbaar zijn; niet-uitgevoerde checks zijn met reden gerapporteerd.
- README en SPEC.md zijn bijgewerkt als hun dashboardbeschrijving niet meer klopt; ARCHITECTURE.md alleen als de feitelijke datastroom wijzigt.
- Er is geen migratie of deploymentwijziging nodig.

## Tasks
