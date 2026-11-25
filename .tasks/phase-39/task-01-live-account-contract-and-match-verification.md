---
id: task-01
title: Live Suivo-contract en matchvalidatie
status: done
complexity: medium
blocked-by: []
---
## Goal
Confirm the reachable account's device and telemetry boundaries, and verify exact FAM vehicle matching without exposing identifiers.

## Acceptance Criteria
- [x] OAuth Client Credentials and the configured REST snapshot work for the reachable account.
- [x] Available device types, unlinked-device count, and unlinked-device telemetry availability are measured using aggregate-only output.
- [x] Zero, one, and multiple exact vehicle matches are covered; ambiguous and missing matches do not create a vehicle link.
- [x] The results are recorded without names, IMEIs, coordinates, credentials, or tokens.

## Notes
- Live account sample on 2026-11-25: 200 units and 182 devices; types `INSTALL` (62) and `INSTALL_PREMIUM` (120); 8 devices were unlinked and none had last-seen, position, or battery data.
- Asset matching returned 142 unique matches, 58 with no exact match, and 0 ambiguous matches in the current snapshot. Existing API tests cover synthetic no/one/multiple outcomes.
- Current trackable-unit snapshot exposes last-seen and positions for 172 devices; battery level and voltage were absent. These observations are account-specific and do not imply subscription status.
