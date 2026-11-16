---
phase: 17
task: 1
title: Reusable pager scan control
status: done
blocked-by: []
---
## Goal
Create a reusable React control for one-shot keyboard-wedge scans on computers and camera QR scans on phones and tablets.

## Context
Follow `.tasks/specs/2026-11-16-qr-asset-scanning.md` and `docs/qr-scanner.md` in Radio Asset Management. Reuse the authenticated pager scanlookup API. Camera support uses `@zxing/browser` because the project has no QR camera package and native browser support varies. Do not add HTTPS or certificate configuration.

## Acceptance Criteria
- [x] Computer button toggles scan mode; Enter submits one raw scan and exits scan mode.
- [x] A user action starts mobile camera scanning; one decoded value is submitted and stops the scanner.
- [x] Streams/scanner resources stop on success, cancellation, and unmount; repeated submissions are suppressed while a request runs.
- [x] Component tests cover keyboard submission and camera lifecycle.
- [x] Dependency purpose is recorded in the dependency documentation.

## Notes
- Added reusable `PagerScanControl` and four keyboard/camera lifecycle tests.
- Added `@zxing/browser` and documented its purpose, MIT license, and secure-context limitation in README and `docs/qr-scanner-dependencies.md`.
- Targeted component tests (4 passed), frontend lint, and TypeScript checks passed in Compose.
