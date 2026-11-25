---
id: task-03
title: Volledige regressie en projectafronding
status: done
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Run the full available verification and close the last open project phase with an accurate record of remaining optional checks.

## Acceptance Criteria
- [x] Backend pytest and Python lint pass; any skipped live-service test has its reason recorded.
- [x] Frontend Vitest, TypeScript, and ESLint pass.
- [x] Migration drift, Compose configuration, and whitespace checks pass.
- [x] Remaining optional visual/Redis integration checks are explicitly carried forward without blocking the completed Suivo scope.

## Notes
- Backend: 294 passed, 1 skipped because it requires explicit live Redis broker opt-in; Ruff and `makemigrations --check --dry-run` passed.
- Frontend: 153 passed; TypeScript and ESLint passed. Compose config and `git diff --check` passed.
- Live Suivo snapshot and push health were checked with aggregate-only output; last push message was current and full sync had succeeded.
- CUA host unavailable; no browser screenshot QA. The optional Redis-broker integration test remains skipped.
