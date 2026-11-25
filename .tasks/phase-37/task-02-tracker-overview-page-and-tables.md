---
id: task-02
title: Trackers-pagina met assets en trackers
status: done
complexity: high
blocked-by: [task-01]
---
## Goal
Add the staff-facing **Trackers** navigation entry with **Assets** and **Trackers** tabs.

## Context
Use the shared API, AppLayout, and Pagers register table pattern. Follow `AGENTS.md`: square corners, accessible controls, title-case muted table headers, fixed column geometry, stable locale-aware sorting, and no sorting for action columns. This page is read-only.

## Acceptance Criteria
- [x] The main navigation includes Trackers and the page has Assets and Trackers tabs.
- [x] Assets lists Suivo units, match state/FAM vehicle, linked device, last-seen, position timestamp/location, and available battery values.
- [x] Trackers lists all account devices including unlinked rows, actual device type, unit link, last-seen, available position/location, and battery values.
- [x] Last-seen and position time are separate; battery level and voltage are separate; missing values are explicit and do not imply subscription status.
- [x] Each tab supports search and stable accessible sorting; loading, empty, error, and stale-snapshot states are visible.
- [x] No device movement, Suivo editing, local assignment, or subscription controls are present.

## Notes
- Added the staff-only Trackers navigation route and two read-only tables with stable sorting, search, explicit unavailable values, and stale-snapshot state.
- The UI distinguishes source timestamps and battery fields; the sample contains no battery value and the page leaves it unavailable.
