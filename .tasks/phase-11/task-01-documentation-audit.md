---
id: task-01
title: Verify managed-object documentation against implementation
status: done
complexity: medium
blocked-by: ~
---
## Goal
Make SPEC.md, ARCHITECTURE.md, and README accurately describe the current managed-object, source-ownership, relationship-history, and inventory UI behavior.

## Context
This task covers phase-11 carry item 1. The code is authoritative for current behavior. The initial and future scope is defined by `.tasks/specs/2026-11-15-generiek-inventarisbeheer.md`; no new architecture is approved by this audit.

## Acceptance Criteria
- [x] SPEC.md states the current managed-object types, source ownership, relationship cardinality/history, service-to-post mapping, and staged future scope accurately.
- [x] ARCHITECTURE.md matches the actual models, migrations, API access, source synchronization, task/result/SSE behavior, and inventory UI.
- [x] README explains the staff inventory workflow and any required configuration without introducing undocumented environment variables.
- [x] No code behavior or architecture is changed as part of documentation-only corrections.

## Notes
- Check all statements against current code and phase-10 test evidence. Preserve the approved no-radio/no-tracker/no-physical-count scope.
- Audited SPEC FR-027–032 and README/ARCHITECTURE inventory, source ownership, HTTP, SSE, single-tenant task-list, retry, result, and recovery statements against current code; no corrections were needed.
