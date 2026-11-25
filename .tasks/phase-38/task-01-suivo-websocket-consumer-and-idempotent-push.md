---
id: task-01
title: Suivo-WebSocketconsumer en statuspush
status: done
complexity: high
blocked-by: []
---
## Goal
Run one dedicated Suivo WebSocket consumer authenticated with Client Credentials and apply `UNIT_STATUS` updates idempotently.

## Context
Use `SUIVO_WSS_URL`, the push protocol in `docs/suivo/`, and the existing `SuivoUnit` snapshot. The installed `websockets` client comes through the already-required `uvicorn[standard]` package; do not add another dependency unless that changes. Never log the token-bearing URL, message payloads, or credentials.

## Acceptance Criteria
- [x] One consumer connects to the configured endpoint with a server-side access token, requests JSON and subscribes only to `UNIT_STATUS`.
- [x] It answers application ping messages, handles server error messages safely, and reconnects with capped backoff.
- [x] Status events update only the referenced unit, merge partial data safely, and are idempotent; unknown unit IDs are ignored for the next full reconciliation.
- [x] Connection health is observable without credentials or payloads; service uses a single configured process.
- [x] Tests cover URI configuration/auth placement, subscription, ping/pong, status merge/idempotence, error handling and backoff.

## Notes
- Implemented in `backend/suivo/push.py` and `consumer.py`; the consumer uses the already-installed `websockets` client, disables transport URL logging, and stores only safe health metadata.
- Full backend suite passed: 294 passed, 1 Redis-broker integration test skipped because it requires explicit live-broker opt-in.
