---
title: Brother test-label backend and dependency
status: done
---
## Goal
Print a simple text test label with the saved Brother PT-P900W configuration and document the printer-driver dependency.

## Context
Use the existing Brother-specific integration note in `docs/brother-qr-label-printing.md` as reference, but follow the approved phase scope: one text label containing printer name and current time, using stored model, IP, port, and tape width. Add `brother-label==2.0a8` and the required Pillow raster renderer; document their purpose and the Brother package's GPLv3+ pre-release status. Do not add QR/pager workflows.

## Acceptance Criteria
- [x] A staff-only print action uses the saved Brother model, address, port, and supported tape width.
- [x] The text label includes the configured printer name and current time.
- [x] Socket/driver failures return a failure; success is returned only when the driver call completes without error.
- [x] Backend tests mock driver I/O and cover configuration mapping, success, failure, and permissions.
- [x] The pinned dependency and its purpose/license status are documented in dependency documentation and README.
- [x] A manual physical proof-print check is clearly recorded as pending or completed; mocked tests are not described as hardware verification.

## Notes

Added the staff-only `POST /api/printers/{id}/print-test-label/` action and BrotherLabel adapter.
Rendered the saved printer name and local timestamp as a monochrome image; sent over the stored TCP port and media width.
Added `brother-label==2.0a8` and Pillow; purpose, GPLv3+ pre-release/API stability, and model verification status are documented in `docs/label-printer-dependencies.md` and README.
Verification: focused printer suite, 20 passed; `ruff check printers` passed.
Physical proof print remains pending; only mocked driver calls have been verified.
