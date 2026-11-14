---
id: task-03
title: Document printer management
status: done
complexity: low
blocked-by: task-01, task-02
---
## Goal
Update project documentation to reflect printer configuration after the module is implemented.

## Context
`README.md`, `SPEC.md`, and `ARCHITECTURE.md` currently describe pager assets and identify printer management as future work. Keep the architecture factual and retain existing details about single-tenant task access, HTTP defaults, SSE polling, and task recovery.

## Acceptance Criteria
- [x] README describes the staff-only Labelprinters page and configured fields.
- [x] SPEC adds functional requirements for printer configuration and staff-only access.
- [x] ARCHITECTURE describes the printer model, API routes, and management page without claiming connection tests or label printing are implemented.
- [x] No new environment variable or deployment command is introduced in this phase.

## Notes
- Updated README, SPEC, and ARCHITECTURE for staff-only printer configuration, stored fields/defaults, API routes, and current scope.
- Architecture documentation still states that connection checks and label printing are not implemented; existing task ownership, HTTP, SSE polling, and recovery details remain in place.
- No environment variable, deployment command, or dependency was added.
