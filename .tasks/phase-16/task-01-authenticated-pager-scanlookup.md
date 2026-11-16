---
phase: 16
task: 1
title: Authenticated pager scanlookup
status: done
blocked-by: []
---
## Goal
Add an authenticated backend endpoint that resolves a raw scanned Fireplan QR URL to a pager by complete URL, using AZERTY/QWERTY alternative candidates.

## Context
Follow `.tasks/specs/2026-11-16-qr-asset-scanning.md`. Preserve the raw scan; recognize its URL format before translating layout variants. Do not extract a Fireplan ID. Invalid and unknown scans need clear error responses.

## Acceptance Criteria
- [x] Valid raw URL matches its pager using the complete stored `fireplan_qr_url`.
- [x] Documented keyboard-layout variants are tried as alternatives without replacing the original candidate.
- [x] Invalid and unknown scans return clear client errors; unauthenticated requests are denied.
- [x] Backend tests cover the matching, variant, invalid, unknown, and auth behaviors.

## Notes
- Added authenticated `POST /api/pagers/scanlookup/`; matching uses complete URL candidates and returns the untouched scan plus pager data.
- Added documented layout alternatives and duplicate-scan half candidates in `backend/assets/scanning.py`; unrelated formats are rejected before DB lookup.
- `docker compose ... run --rm api pytest assets/tests/test_pager_scanlookup.py -q`: 9 passed.
