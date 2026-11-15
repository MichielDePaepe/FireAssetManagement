---
id: task-02
title: Document CityGIS integration and verify project
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Document the configured CityGIS integration and run the project's applicable checks, recording any environmental blockers accurately.

## Context
The integration uses the Fireplan credential record, `CITYGIS_RESOURCES_BASE_URL`, Celery Beat once per minute, database-polled SSE, and a staff-only API/page.

## Acceptance Criteria
- [x] README, ARCHITECTURE.md, SPEC.md, and `.env.example` describe the integration, base URL, schedule, SSE, and credential reuse/authentication.
- [x] Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks are run where available; failures and unavailable checks are recorded.
- [x] Project phase/task records are closed with carry-forward and open follow-ups.

## Notes
Documentation now describes the one-minute Beat schedule, staff-only snapshot/manual refresh/SSE routes, credential reuse, snapshot preservation, and internal source limitations. `python3 -m compileall -q backend/citygis backend/config/settings.py`, direct parser checks, and `git diff --check` passed. A live refresh succeeded on the target network (229 vehicles, 129 vectors, one duplicate vector match logged). Backend pytest and Ruff could not run (`pytest` and `ruff` are absent); frontend Vitest, ESLint, and TypeScript checks could not run because `frontend/node_modules` has no installed executables. The app API later timed out and Docker access was unavailable for a service restart. No test or lint result is claimed as passing.
