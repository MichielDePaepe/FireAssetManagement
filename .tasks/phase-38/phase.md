---
phase: 38
title: Suivo push en dagelijkse reconciliatie
status: open
opened: 2026-11-25
closed: ~
---
## Carry from phase 37
1. Trackers page and staff-only snapshot endpoints are in place. Unit matching is exact after trim/case-folding; ambiguity remains unlinked.
2. The 2026-11-25 live sample had 8 devices without a unit and those device rows contained only identity/type fields. Most unit status rows supplied last-seen and position; no battery-named field appeared. Keep unavailable fields explicit.

## Open follow-ups from phase 37
- Optional Redis-gated Celery/SSE integration test from phase 35 remains unverified.
- Repeat visual browser QA when the unavailable CUA/browser host is accessible.

## Goal
Verwerk Suivo-unitstatusupdates bijna direct en herstel gemiste updates met een dagelijkse volledige reconciliatie en handmatige refresh.

## Exit Criteria
- Eén dedicated achtergrondproces opent de Suivo-WebSocket, abonneert zich op `UNIT_STATUS`, antwoordt op pings, verwerkt events idempotent en herverbindt met begrensde backoff.
- Er wordt maximaal één Suivo-WebSocketverbinding gebruikt. Logs lekken geen credentials, access tokens of gevoelige payloads.
- Celery Beat plant één volledige reconciliatie per dag in en herstelt veilig na herstart.
- **Alles vernieuwen** start een volledige sync via de bestaande Celery/SSE/task-result-flow; de UI toont voortgang, resultaat en laatste geslaagde volledige sync.
- Bij disconnect blijven de laatste gegevens met bron-tijdstempels zichtbaar; reconnect en volledige sync herstellen de kopie. Push wordt niet als gebufferd beschouwd.
- Compose-documentatie beschrijft consumer, Beat-service, health/restartgedrag en schedulerstatus; er komt geen tweede taakframework of resultaatopslag.
- Tests dekken push-authenticatie, subscription, statusupdates, ping, reconnect, idempotentie, taakvoortgang, schedulerconfiguratie en handmatige refresh.

## Tasks
- [ ] task-01-suivo-websocket-consumer-and-idempotent-push.md
- [ ] task-02-daily-reconciliation-and-manual-refresh-ui.md
- [ ] task-03-compose-health-and-phase-verification.md
