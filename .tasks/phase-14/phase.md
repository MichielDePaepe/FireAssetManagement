---
phase: 14
title: Documentation and verification
status: pending
opened: ~
closed: ~
---
## Goal
Update the product and architecture documentation and verify the location-management API and user flow.

## Exit Criteria
- SPEC.md, ARCHITECTURE.md, and README.md describe the location-management page, service-to-post mapping, derived vehicle display, and scope boundaries accurately.
- Backend tests cover staff access, location CRUD, parent-cycle prevention, service mapping validation, protected deletion, and post overview data.
- Frontend tests cover hierarchy navigation, create/edit/delete behavior, post vector and vehicle display, and loading/error/empty states.
- Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.

## Tasks
