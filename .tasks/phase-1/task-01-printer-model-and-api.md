---
id: task-01
title: Printer model and staff-only API
status: pending
complexity: medium
blocked-by: ~
---
## Goal
Create the printer Django module's persistent configuration model and authenticated CRUD API for staff users.

## Context
The project uses Django/DRF and stores application data in PostgreSQL. Pager records live in `backend/assets`, while printer configuration belongs in a separate app. Use the project’s session authentication, CSRF, API routing, serializer validation, and migration conventions. The approved initial model is Brother PT-P900W; keep manufacturer/model as data fields for future driver integrations.

## Acceptance Criteria
- [ ] Printer records store a management name, manufacturer, model, IP address, TCP port (default 9100), and tape width (default 12 mm).
- [ ] A migration creates the printer table without modifying pager records.
- [ ] Staff-only API supports list, create, retrieve, update, and delete.
- [ ] API validation rejects blank names, malformed IPs, invalid ports, unsupported initial models, and widths outside 6, 12, 18, 24, and 36 mm.
- [ ] Non-staff users and anonymous clients cannot access printer records.
- [ ] Backend tests cover CRUD, validation, and access control; any network or driver I/O remains outside this phase.

## Notes
