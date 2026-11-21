---
task: 23.2
title: Document FirePlan inventory module
status: done
blocked-by: [23.1]
---
## Goal
Bring the product specification and user/technical documentation in line with the implemented FirePlan inventory synchronization behavior and its confirmed limits.

## Context
Document the summary-only staff list, inclusive manual period refresh, existing Celery task progress/result path, historical relationship behavior, and unconfirmed `updatedAt` semantics. The direct YAML parser dependency is documented in `backend/requirements.txt` and `docs/fireplan-inventory-dependencies.md`. Add environment documentation only if the implementation introduces a new setting.

## Acceptance Criteria
- [x] `SPEC.md` records the staff inventory list, period processing, saved task result, summary-only scope, and `updatedAt` limitation.
- [x] `README.md` explains how staff use the page and how manual reprocessing behaves.
- [x] `ARCHITECTURE.md` accurately describes API, UI, task flow, hourly behavior, and no-full-detail-scan limit.
- [x] Dependency documentation accounts for PyYAML; `.env.example` is updated only if a new environment variable exists.
- [x] Run Python lint, Django checks, frontend ESLint, TypeScript, and frontend build/type verification; report exact results and environment limitations.
- [x] Documentation diff is factually consistent with the implementation and verification evidence.

## Notes
- Added FR-038 and the `updatedAt` limitation to `SPEC.md`; added the staff workflow to `README.md` and the UI/API/task behavior to `ARCHITECTURE.md`.
- Confirmed `docs/fireplan-inventory-dependencies.md` already documents PyYAML and mapping choices; no new environment variable was introduced, so `.env.example` did not need a change.
- Ruff, Django check, migration check, frontend ESLint, TypeScript, and production build passed. Vite emitted non-fatal Rollup annotation warnings from Zod dependencies.
