---
id: task-03
title: Trackerregressies en faseverificatie
status: done
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Verify the Suivo overview API and UI against account-confirmed fields and document any important field limits.

## Context
Use the dated live sample carried from phase 36, but treat it as changeable. Do not include raw account names, identifiers, or locations in tests or documentation.

## Acceptance Criteria
- [x] Backend and frontend tests cover exact/ambiguous/no-match behavior, both tables, unlinked devices, separate timestamps/battery fields, and loading/empty/error/stale states.
- [x] Python lint, frontend ESLint, TypeScript, focused tests, migrations, and `git diff --check` pass where applicable.
- [x] Any unavailable account telemetry is shown as unavailable without extrapolating subscription state.
- [x] Phase task notes and phase carry-forward accurately capture remaining operational follow-ups.

## Notes
- Backend Suivo tests: 13 passed; frontend table/navigation tests: 7 passed; TypeScript, ESLint, Ruff, migrations and diff check passed.
- CUA/browser host was unavailable, so no interactive screenshot review could be done. Source and rendered component tests were reviewed.
