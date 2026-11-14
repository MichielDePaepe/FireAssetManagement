---
id: task-03
title: Document printer management
status: pending
complexity: low
blocked-by: task-01, task-02
---
## Goal
Update project documentation to reflect printer configuration after the module is implemented.

## Context
`README.md`, `SPEC.md`, and `ARCHITECTURE.md` currently describe pager assets and identify printer management as future work. Keep the architecture factual and retain existing details about single-tenant task access, HTTP defaults, SSE polling, and task recovery.

## Acceptance Criteria
- [ ] README describes the staff-only Labelprinters page and configured fields.
- [ ] SPEC adds functional requirements for printer configuration and staff-only access.
- [ ] ARCHITECTURE describes the printer model, API routes, and management page without claiming connection tests or label printing are implemented.
- [ ] No new environment variable or deployment command is introduced in this phase.

## Notes
