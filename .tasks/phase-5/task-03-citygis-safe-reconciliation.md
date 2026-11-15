---
id: task-03
title: Safe CityGIS synchronization and vehicle matching
status: done
complexity: high
blocked-by: task-01, task-02
---
## Goal
Reconcile complete Fireplan and resources-service snapshots atomically, preserve each raw vector status and timestamp, link vehicles deterministically, and retain records that disappear from a source.

## Context
Read `.tasks/specs/2026-11-14-citygis-module.md`. Compare trimmed, case-insensitive vector `Name` with Fireplan `alphacode`. For multiple vector records mapping to one vehicle, link the first in source order, keep later vectors unlinked, and log each duplicate as an error. Never choose a vector status by numeric maximum.

## Acceptance Criteria
- [x] Both complete source snapshots are fetched and validated before database changes begin; a failed or malformed fetch leaves stored data untouched.
- [x] Vehicles and each vector record are independently upserted, including raw string status and parsed `LastStatusTimeUpdated`.
- [x] A matching vector links to the Fireplan vehicle; unmatched vectors remain unlinked.
- [x] The first vector matching a vehicle is linked; subsequent matches remain stored but unlinked and produce structured error logs with identifying context.
- [x] Successful snapshots mark observed records current and previously stored missing records as no longer reported, without deleting them; reappearing records become current.
- [x] Tests cover mapping, status parsing, duplicate behavior/logging, stale/reappearing records, and transaction safety.

## Notes
Replaced synchronization logic with pre-validation, transactional upserts, source-presence tracking, rebuilt one-to-one links, first-match selection, and structured duplicate errors. Added reconciliation tests for statuses/timestamps, unmatched and duplicate links, link reordering, stale/reappearing rows, and no partial writes. All 19 CityGIS tests pass on SQLite.
