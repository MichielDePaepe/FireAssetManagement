---
id: task-03
title: Suivo-foutpaden en faseverificatie
status: done
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Maak sync-fouten veilig zichtbaar en verifieer fase 36 binnen de beschikbare accounttoegang.

## Context
Accountvalidatie moet vaststellen of Client Credentials werken, welke units/devices toegankelijk zijn, welke devices geen unit hebben en welke actuele telemetry werkelijk terugkomt. Een auth/permissiefout is een setup-fout; voer geen alternatieve grant in.

## Acceptance Criteria
- [x] Staff kan syncstatus en een niet-gevoelige foutmelding zien; secrets/tokens/payloads lekken niet naar browser of logs.
- [x] Accountvalidatie is uitgevoerd; aantallen, types en veldbeschikbaarheid staan zonder bronidentificatoren in de carry-forward.
- [x] Suivo-backendtests (9), Ruff, migratiecontrole en diff-check slagen; frontendchecks zijn niet van toepassing op deze backendfase.
- [x] `README.md`, `SPEC.md`, `ARCHITECTURE.md` en `.env.example` zijn bijgewerkt; `git diff --check` slaagt.

## Notes
- Account OAuth succeeded. The response contained 200 units, 182 devices (8 without a unit), two device types, and 200 unit status rows. 195 rows had last-seen and 193 had a position; no battery-named status field appeared. Unlinked device records exposed identity/type only.
- No source names, IDs, coordinates, credentials or tokens were recorded. Account telemetry can change; phase 39 should carry these as a dated sample.
