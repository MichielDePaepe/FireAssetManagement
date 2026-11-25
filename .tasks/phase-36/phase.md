---
phase: 36
title: Suivo API en actuele kopie
status: pending
opened: ~
closed: ~
---
## Goal
Verbind FAM veilig met de Suivo API en synchroniseer assets, devices en de beschikbare actuele status zonder brongegevens in Suivo te wijzigen.

## Carry from phase 35
- none

## Open follow-ups from phase 35
- The optional Redis-gated Celery/SSE integration test remains unverified; the full backend suite skipped it because no live broker was enabled, and an earlier forced run did not terminate.

## Exit Criteria
- Suivo OAuth Client Credentials gebruikt `SUIVO_CLIENT_ID` en `SUIVO_CLIENT_SECRET` uit `.env`; `.env.example` documenteert beide zonder echte waarden. Tokens en credentials verschijnen niet in logs of browserresponses.
- De API-client leest units, devices en beschikbare actuele unitstatus via de Suivo API en gebruikt stabiele Suivo-ID's voor idempotente opslag. Niet meer teruggegeven bronrecords worden niet stilzwijgend verwijderd.
- Een handmatige volledige synchronisatie gebruikt de bestaande Celery-task-, voortgangs-, resultaat- en SSE-patronen. Een mislukte of gedeeltelijke run behoudt de vorige succesvolle kopie en rapporteert de fout.
- De accounttest bevestigt of Client Credentials werkt, welke units/devices toegankelijk zijn, welke ongekoppelde devices terugkomen en welke telemetry beschikbaar is. Een authenticatie- of permissiefout wordt gerapporteerd zonder stilzwijgend een andere grant of extra credentials in te voeren.
- Backendtests dekken OAuth-fouten zonder secrets te lekken, responsmapping, idempotente updates, onvolledige telemetry en behoud van de vorige snapshot na fouten.

## Tasks
