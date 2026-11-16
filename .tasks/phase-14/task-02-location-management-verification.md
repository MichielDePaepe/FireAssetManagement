---
id: task-02
title: Verify location API and user flow
status: done
complexity: high
blocked-by: task-01
---
## Goal
Run the location API and frontend regression checks and verify the authenticated Beheer → Locaties user flow.

## Context
Backend tests cover staff authorization, location CRUD, parent/service validation, protected deletion, service options, and post overview. Frontend tests cover hierarchy, CRUD, post vector/status/vehicle display, and state handling. Phase 12's Django system and migration-drift checks remain unverified. Phase 13's browser inspection was blocked because the browser access host was unavailable.

## Acceptance Criteria
- [x] Backend pytest passes, including location CRUD, authorization, validation, deletion, and post overview; any failure is named and recorded.
- [x] Django system checks, migration-drift check, and Python lint pass or their availability/reasons are recorded accurately.
- [x] Frontend Vitest, ESLint, and TypeScript checks pass or their availability/reasons are recorded accurately.
- [x] The authenticated `/locations` route is inspected in a browser for hierarchy, form alignment, post overview, and accessible error/empty behavior; an unavailable browser is explicitly recorded as unresolved.

## Notes
- Backend suite: 149 passed, 1 Redis integration test skipped because it requires a live Redis broker; full Ruff passed.
- Frontend suite: 71 passed; ESLint and TypeScript passed.
- Django `check` and `makemigrations --check --dry-run` commands were denied access to the Docker socket. No schema changes were made in phases 12-14.
- Browser inspection was not possible: the CUA inventory reported that the browser access host was unavailable; authenticated visual verification remains unresolved.
