---
phase: 15
title: Location sort order
status: closed
opened: 2026-11-16
closed: 2026-11-16
---
## Goal
Allow staff to influence location-tree sorting with an optional sort name that remains hidden under advanced options by default.

## Carry from phase 14
- none

## Open follow-ups from phase 14
- Recheck the authenticated `/locations` page visually when browser access is available.
- Rerun Django system and migration-drift checks with Docker socket access.

## Exit Criteria
- Nonblank sort names sort first alphabetically, then by location name; blank values sort last, with name as the fallback.
- Create and edit forms expose the optional field in a collapsed-by-default advanced section.
- API, model migration, frontend, tests, and relevant documentation match the behavior.
- Relevant backend and frontend checks pass, or unavailable checks are recorded accurately.

## Tasks
- [x] task-01-location-sort-order.md

## Execution Notes
- Backend pytest: 149 passed, 1 Redis-gated test skipped; Ruff passed.
- Frontend Vitest: 72 passed, including 11 location tests; ESLint and TypeScript passed.
- The model migration was applied while running backend tests. `makemigrations --check --dry-run` and `manage.py check` could not run because Docker denied access to its socket.

## Carry-forward

### Carry from phase 15
- none

### Open follow-ups from phase 15
- Rerun `makemigrations --check --dry-run` and `manage.py check` with Docker socket access.
- Recheck the authenticated `/locations` page visually when browser access is available.
