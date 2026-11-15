---
phase: 11
title: Documentation and verification
status: closed
opened: 2026-11-15
closed: 2026-11-15
---
## Goal
Document the managed-object model and verify migration, source ownership, history, access control, and the type-driven relationship manager.

## Carry from phase 10
1. Verify the inventory page through the staff-facing route and preserve its API boundary: CityGIS/Fireplan values remain read-only; pager and RiC/AdC vector links use the history-backed inventory endpoints.
2. In a browser-capable environment, visually verify the authenticated type-driven sortable table and relationship modal, including separated vector/RiC columns, CityGIS status colors and weight, toolbar placement, the below-modal dropdown, and filtered choices; frontend tests, build output, and an HTTP 200 from the Vite route do not prove the rendered authenticated experience.

## Resolution of phase-10 follow-ups
- Authenticated browser verification completed at the staff-facing `/inventory` route; table, statuses, sorting, modal dropdown placement, and available-choice search were inspected.
- The opt-in Celery/SSE test passes with Compose Redis in 12.46 seconds. Pytest teardown still logs a Celery pidbox `AttributeError` and a warning that two database sessions remain open.
- Fixed all 15 Ruff lint findings; `ruff check .` passes. `ruff format --check .` still reports 17 files that need formatting; broad formatting was not required by the lint gate and remains a style follow-up.
- API port 8001 is intentionally private: the frontend proxies same-origin API routes, as documented. Fixed the development frontend healthcheck to probe Vite on port 5173 instead of the production Nginx port 80.

## Exit Criteria
- SPEC.md and ARCHITECTURE.md describe object types, source ownership, service-to-post mapping, relationship history, and the initial and future scope.
- README documents required setup and operational behavior; .env.example is updated only if a new environment variable is added.
- Backend tests cover migration preservation, source ownership, unmapped services, assignment cardinality, physical-location observations, timestamp distinctions, history transitions, and source failures.
- Frontend tests cover type selection, searchable lists, relationship modals in both directions, source-owned read-only fields, and loading/error/empty states.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or unavailable checks are reported with reasons.

## Tasks
- [x] task-01-documentation-audit.md
- [x] task-02-backend-migration-and-regression-verification.md
- [x] task-03-frontend-runtime-and-visual-verification.md

## Carry-forward
- If repo-wide formatting becomes a required CI gate, format the 17 files reported by `ruff format --check .` and review the resulting diff before enabling it.
- Investigate the Celery pidbox teardown error and lingering database sessions from the opt-in Redis/SSE integration test if they recur or affect CI; the test itself currently passes.
