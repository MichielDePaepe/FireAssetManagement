---
phase: 2
title: Connection checks and test labels
status: pending
opened: ~
closed: ~
---
## Goal
Add a bounded direct network check and a simple text test label for configured Brother PT-P900W printers, using the saved TCP settings and tape width.

## Exit Criteria
- A connection action reports reachable, timeout, or connection failure without claiming printer readiness or tape state.
- A test-label action sends printer name and current time through the Brother driver using the saved model, IP, port, and supported tape width.
- Driver and socket failures are reported as failures; no success is shown when printing raises an error.
- Backend tests mock socket and driver I/O; frontend tests cover both actions and their loading, success, and error states.
- The Brother dependency and its purpose/license status are documented; a real proof print is recorded as a separate manual hardware check.

## Tasks
