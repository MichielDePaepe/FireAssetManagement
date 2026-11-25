---
id: task-02
title: Suivo-documentatie en configuratie afronden
status: done
complexity: low
blocked-by: [task-01]
---
## Goal
Make the reusable template documentation and environment example accurately describe the complete Suivo integration.

## Acceptance Criteria
- [x] README, `.env.example`, `SPEC.md`, and `ARCHITECTURE.md` document Client Credentials and configurable REST/WebSocket endpoints.
- [x] Documentation covers the single push consumer, daily 03:00 Europe/Brussels reconciliation, manual refresh and existing task/SSE result flow.
- [x] Stale-data behavior and the unbuffered-event recovery limit are explicit; missing telemetry is not treated as subscription evidence.
- [x] No Suivo writes, local tracker placement, subscription management, history archive, or operational map workflow was introduced.

## Notes
- Reviewed the current docs and `.env.example`; the environment example contains only non-secret defaults and blank credentials.
- The observed account capabilities are recorded in this task; shared README and architecture remain reusable and avoid embedding transient account totals.
