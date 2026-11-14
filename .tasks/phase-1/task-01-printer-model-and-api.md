---
id: task-01
title: Printer model and staff-only API
status: done
complexity: medium
blocked-by: ~
---
## Goal
Create the printer Django module's persistent configuration model and authenticated CRUD API for staff users.

## Context
The project uses Django/DRF and stores application data in PostgreSQL. Pager records live in `backend/assets`, while printer configuration belongs in a separate app. Use the project’s session authentication, CSRF, API routing, serializer validation, and migration conventions. The approved initial model is Brother PT-P900W; keep manufacturer/model as data fields for future driver integrations.

## Acceptance Criteria
- [x] Printer records store a management name, manufacturer, model, IP address, TCP port (default 9100), and tape width (default 12 mm).
- [x] A migration creates the printer table without modifying pager records.
- [x] Staff-only API supports list, create, retrieve, update, and delete.
- [x] API validation rejects blank names, malformed IPs, invalid ports, unsupported initial models, and widths outside 6, 12, 18, 24, and 36 mm.
- [x] Non-staff users and anonymous clients cannot access printer records.
- [x] Backend tests cover CRUD, validation, and access control; any network or driver I/O remains outside this phase.

## Notes
- Added the `printers` Django app, `Printer` model/migration, and staff-only `/api/printers/` CRUD routes.
- Validation limits the initial model to Brother PT-P900W and checks IP, port, and supported tape widths.
- Focused API tests: 11 passed. `ruff check printers` passed; `makemigrations --check --dry-run printers` reported no changes.
- No printer network or driver I/O is included in this task.
