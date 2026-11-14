---
id: task-02
title: Staff printer-management page
status: done
complexity: medium
blocked-by: task-01
---
## Goal
Add a staff-only Beheer → Labelprinters page for managing configured printer records.

## Context
The frontend uses React, strict TypeScript, React Router, shared shadcn-style components, and the existing session auth state. Follow the existing Fireplan settings page for staff-area navigation and route protection, and the Pagers page for list/form/loading/error patterns. The initial model choice is Brother PT-P900W. Connection checks and test-label printing are a later phase.

## Acceptance Criteria
- [x] Staff users can navigate to the Labelprinters page from Beheer and manage printer records.
- [x] The form collects management name, IP address, TCP port, and default tape width; manufacturer/model initially expose Brother PT-P900W.
- [x] The UI supports add, edit, list, and delete, with accessible labels and validation feedback.
- [x] Loading, empty, API error, and success states are handled.
- [x] Non-staff users cannot reach the page or its API actions.
- [x] Frontend tests cover create/edit flows, validation, loading, and API errors.
- [x] All interface components keep square corners and use shared primitives.

## Notes
- Added `LabelPrintersPage` with validated add/edit forms, printer listing, and confirmed deletion.
- Added typed printer API methods, staff-only navigation and command-palette entries, and the route under the existing admin guard.
- Frontend tests: 11 passed. ESLint and TypeScript checks passed.
- Connection checks and test-label printing remain in Phase 2.
