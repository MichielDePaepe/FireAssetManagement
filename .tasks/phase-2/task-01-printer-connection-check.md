---
title: Bounded printer connection check
status: done
---
## Goal
Add a staff-only direct TCP reachability action for a saved printer, with a bounded timeout and distinct reachable, timeout, and connection-failure outcomes.

## Context
Reuse the existing `Printer` record and `/api/printers/` viewset. The check confirms only that the configured TCP port accepts a connection; it must not imply the printer is ready or has tape. Keep this synchronous and independent of Celery/SSE.

## Acceptance Criteria
- [x] A staff-only action is exposed for a saved printer; unauthenticated and non-staff users cannot invoke it.
- [x] It connects to the saved IP and port with a short, explicit timeout.
- [x] The response distinguishes reachable, timeout, and connection failure without leaking internals or claiming physical readiness.
- [x] Backend tests mock socket I/O and cover each outcome and permissions.

## Notes

Implemented `POST /api/printers/{id}/check-connection/` with a two-second TCP timeout and generic outcomes.
Added mock-based coverage for reachable, timeout, connection failure, and non-staff denial.
Verification: focused Docker pytest suite, 15 passed.
The result confirms TCP reachability only; physical printer readiness is not inferred.
