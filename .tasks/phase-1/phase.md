---
phase: 1
title: Printer management
status: open
opened: 2026-11-14
closed: ~
---
## Goal
Provide staff-only management of printer records through the Django API and React app. The initial UI supports the Brother PT-P900W and stores settings needed for later connection checks and test labels.

## Exit Criteria
- Printer records have a management name, manufacturer, model, IP address, TCP port, and default tape width, with a migration and validated API.
- Only staff users can list, create, edit, or delete printers through the API and frontend.
- Staff can add, edit, list, and delete printer records from Beheer → Labelprinters.
- Backend and frontend tests cover validation, authorization, loading, and error states.
- README, SPEC, and ARCHITECTURE describe the implemented printer-management behavior accurately.

## Tasks
- [ ] task-01-printer-model-and-api.md
- [ ] task-02-printer-management-ui.md
- [ ] task-03-printer-management-docs.md
