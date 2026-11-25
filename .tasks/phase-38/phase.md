---
phase: 38
title: Suivo push en dagelijkse reconciliatie
status: pending
opened: ~
closed: ~
---
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
