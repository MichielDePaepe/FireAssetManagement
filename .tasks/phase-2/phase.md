---
phase: 2
title: Connection checks and test labels
status: pending
opened: ~
closed: ~
---
## Goal
Add a bounded direct network check and a simple text test label for configured Brother PT-P900W printers, using the saved TCP settings and tape width.

## Carry from phase 1
1. Reuse the staff-only `/api/printers/` CRUD model and its fields: `name`, `manufacturer`, `model`, `ip_address`, `port` (default `9100`), and `tape_width_mm` (default `12`).
2. Run checks with the Docker Compose environment; the host Python does not include pytest. Mock socket and Brother driver I/O in automated tests, then perform a separate manual proof print on physical hardware.

## Open follow-ups from phase 1
- Repository-wide checks still report unrelated failures in existing pager/Celery tests, existing Fireplan/Pagers toast tests, and Ruff import ordering in Fireplan files. Keep these outside Phase 2 unless separately scoped.

## Exit Criteria
- A connection action reports reachable, timeout, or connection failure without claiming printer readiness or tape state.
- A test-label action sends printer name and current time through the Brother driver using the saved model, IP, port, and supported tape width.
- Driver and socket failures are reported as failures; no success is shown when printing raises an error.
- Backend tests mock socket and driver I/O; frontend tests cover both actions and their loading, success, and error states.
- The Brother dependency and its purpose/license status are documented; a real proof print is recorded as a separate manual hardware check.

## Tasks
