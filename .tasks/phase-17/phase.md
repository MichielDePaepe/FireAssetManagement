---
phase: 17
title: Reusable scan controls
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Build a reusable frontend control for one-shot keyboard-wedge scanning on computers and camera QR scanning on phones and tablets.

## Carry from phase 16
- none

## Open follow-ups from phase 16
- Location migration/system checks and authenticated `/locations` visual recheck carried from phase 15 remain outstanding.

## Exit Criteria
- On computers, the button toggles scan mode; Enter submits one scan and automatically exits scan mode.
- On phones and tablets, a user action starts the camera scanner and one decoded code stops it.
- Camera streams and scanner resources are stopped on success, cancellation, and view unmount.
- No HTTPS hosting or certificate changes are included; camera access depends on a secure browser context.

## Tasks
- [x] task-01-reusable-pager-scan-control.md

## Execution Notes
- Reusable keyboard and camera scan control completed; targeted tests, lint, and TypeScript checks passed.

## Carry-forward

### Carry from phase 17
- none

### Open follow-ups from phase 17
- Location migration/system checks and authenticated `/locations` visual recheck carried from phase 15 remain outstanding.
