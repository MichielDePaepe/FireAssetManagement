---
id: task-01
title: Suivo-configuratie en read-only API-client
status: done
complexity: high
blocked-by: []
---
## Goal
Voeg een server-side Suivo OAuth Client Credentials-client toe voor units, devices en actuele unitstatus.

## Context
Gebruik de ongetrackte Suivo API-documentatie in `docs/suivo/` als contractbron. Lees nooit `docs/suivo/.env` naar terminaloutput of logs. Hergebruik bestaande HTTP/dependencypatronen en houd de integratie read-only.

## Acceptance Criteria
- [x] Client ID/secret en REST/WebSocket endpoints komen uit environment; veilige defaults zijn gedocumenteerd.
- [ ] Client Credentials authenticatie, timeout, responsevalidatie en begrensde retries volgen de gedocumenteerde API.
- [x] API-methoden lezen units, devices en unit-status; tokens blijven in de server-side client en foutmeldingen zijn secret-safe.
- [x] Tests dekken tokenaanvraag, auth/API-fouten, responsmapping, ongekoppelde devices en lege statusdata.
- [x] Suivo-variabelen staan in `.env.example` en README; geen dependency toegevoegd.

## Notes
- Added standard-library OAuth/API client for the documented JSON collection envelopes; tested safe HTTP/auth errors.
- Live account check succeeded using Client Credentials. No token, record IDs, names or coordinates were logged.
