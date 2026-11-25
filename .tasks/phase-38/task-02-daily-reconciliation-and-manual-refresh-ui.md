---
id: task-02
title: Dagelijkse sync en Alles vernieuwen
status: pending
complexity: high
blocked-by: [task-01]
---
## Goal
Reconcile the complete Suivo REST snapshot once per day and expose a manual full refresh in the Trackers page.

## Context
Reuse `suivo.sync`, Celery Beat, the existing task ID/progress/result/SSE flow and the current page. Keep one Beat instance, persist its scheduler state, and schedule according to Europe/Brussels time.

## Acceptance Criteria
- [ ] Celery Beat queues one full `suivo.sync` reconciliation daily and safely resumes after restart.
- [ ] Manual **Alles vernieuwen** starts that same task and shows progress, result and last successful full sync.
- [ ] Refresh errors keep the last successful snapshot visible and label it stale; push events are not treated as buffered.
- [ ] Tests cover scheduler timing/configuration and manual task launch/progress wiring.

## Notes
