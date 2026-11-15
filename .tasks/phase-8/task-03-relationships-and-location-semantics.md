---
id: task-03
title: Typed relationships and location semantics
status: done
complexity: high
blocked-by: task-01, task-02
---
## Goal
Model operational assignment, physical-location observation, and derived expected location as distinct concepts, with typed relationships between managed objects.

## Context
An asset has at most one active operational assignment. That assignment is independent of where the asset was last physically observed. Expected location is derived from the assignment path and the current CityGIS vector-vehicle relationship. Future assets may relate to vectors or other assets such as vehicles, cabinets, or cabinet positions. RiC/AdC records remain separate from physical assets and can be linked to vectors.

## Acceptance Criteria
- [x] Relationships have explicit meanings and can connect eligible managed-object types without limiting targets to vectors and vehicles.
- [x] Each physical asset can have at most one active operational assignment; a previous assignment is retained as history.
- [x] A physical-location observation can coexist with an operational assignment and records the location and observation time.
- [x] Expected physical location is derived and is not stored as an observation or independent source of truth.
- [x] RiC/AdC-to-vector relationships retain history, with at most one active vector per code and multiple codes allowed per vector.
- [x] Tests cover allowed relationship types, assignment cardinality, concurrent assignment and observation, expected-location derivation, and RiC-code cardinality.

## Notes
- Added typed managed-object relationships with an active-assignment database constraint and serialized replacement that retains prior assignments.
- Added separate timestamped physical-location observations; expected location resolves through a vector to its current CityGIS vehicle and is not stored.
- Added RiC/AdC-to-vector relationship history with one active vector per code and multiple codes per vector.
- 7 focused relationship/model tests pass, including concurrent assignment; migration drift check passes.
