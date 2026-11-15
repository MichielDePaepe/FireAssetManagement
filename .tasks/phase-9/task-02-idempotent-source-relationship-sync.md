---
id: task-02
title: Idempotent CityGIS relationship reconciliation
status: done
complexity: high
blocked-by: task-01
---
## Goal
Reconcile complete CityGIS snapshots into current vector links and association history without duplicate events or loss of the existing matching semantics.

## Context
The existing sync validates both complete source lists before writes, wraps reconciliation in a database transaction, preserves separate source identifiers, maps services by abbreviation, matches vehicles by trimmed case-insensitive `Name`/`alphacode`, and links only the first vector for duplicate vehicle matches. Keep those rules unless a stable source key supports an improvement. The live source provides no relationship-effective timestamp; new history entries must keep that value unknown and use the sync time only as the observed time.

## Acceptance Criteria
- [x] A changed service or vehicle association closes its prior history row and creates one new row with a sync-observed timestamp; source-effective time remains null unless an explicitly relationship-specific source field is established.
- [x] Repeating an identical complete snapshot creates no history row and does not change the original event timestamps.
- [x] Changes to blank/unmatched associations are recorded with their source values; vector absence follows the existing `is_current` behavior without inventing a new association.
- [x] Duplicate vector matches, source order, stable vector identity, and distinct `ResourceCode`/`pResourceCode` meanings remain intact.
- [x] Tests cover first sync, changed and unchanged relationships, rematching, unmatched values, and invalid snapshots that roll back all record and history changes.

## Notes
- CityGIS reconciliation now closes and appends source relationship history only when the target or source value changes; repeated snapshots and status-only timestamp changes add no association events.
- It records blank/unmatched states and retains the last known history if a vector is absent, consistent with the existing `is_current` projection behavior.
- 19 focused history, migration, and reconciliation tests pass; migration drift and changed-file Ruff checks pass.
