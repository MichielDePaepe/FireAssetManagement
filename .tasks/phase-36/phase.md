---
phase: 36
title: Suivo API en actuele kopie
status: closed
opened: 2026-11-25
closed: 2026-11-25
---
## Goal
Verbind FAM veilig met de Suivo API en synchroniseer assets, devices en de beschikbare actuele status zonder brongegevens in Suivo te wijzigen.

## Carry from phase 35
- none

## Open follow-ups from phase 35
- The optional Redis-gated Celery/SSE integration test remains unverified; the full backend suite skipped it because no live broker was enabled, and an earlier forced run did not terminate.

## Exit Criteria
- Suivo OAuth Client Credentials gebruikt `SUIVO_CLIENT_ID` en `SUIVO_CLIENT_SECRET` uit `.env`. `SUIVO_BASE_URL` en `SUIVO_WSS_URL` configureren respectievelijk de REST API en WebSocket; `.env.example` documenteert de standaardadressen `https://integrate.suivo.com` en `wss://integrate.suivo.com/socket`. De API-client en consumer lezen de geconfigureerde URL's uit de omgeving. Tokens en credentials verschijnen niet in logs of browserresponses.
- De API-client leest units, devices en beschikbare actuele unitstatus via de Suivo API en gebruikt stabiele Suivo-ID's voor idempotente opslag. Niet meer teruggegeven bronrecords worden niet stilzwijgend verwijderd.
- Een handmatige volledige synchronisatie gebruikt de bestaande Celery-task-, voortgangs-, resultaat- en SSE-patronen. Een mislukte of gedeeltelijke run behoudt de vorige succesvolle kopie en rapporteert de fout.
- De accounttest bevestigt of Client Credentials werkt, welke units/devices toegankelijk zijn, welke ongekoppelde devices terugkomen en welke telemetry beschikbaar is. Een authenticatie- of permissiefout wordt gerapporteerd zonder stilzwijgend een andere grant of extra credentials in te voeren.
- Backendtests dekken OAuth-fouten zonder secrets te lekken, responsmapping, idempotente updates, onvolledige telemetry en behoud van de vorige snapshot na fouten.

## Tasks
- [x] task-01-suivo-api-client-and-configuration.md
- [x] task-02-snapshot-model-and-full-sync-task.md
- [x] task-03-error-handling-and-phase-36-verification.md

## Carry-forward

### Carry from phase 36
- Suivo OAuth and REST snapshot synchronization are implemented; real responses use numeric `@id`, `@imei`, and nested unit references.
- 2026-11-25 account sample: 200 units, 182 devices (8 unlinked), two device types and 200 joined status rows. 195 rows had last-seen, 193 had position, and no battery-named telemetry field was present. Recheck before promising fields.

### Open follow-ups from phase 36
- Optional Redis-gated Celery/SSE integration test from phase 35 remains unverified because the live broker integration test was not run.
