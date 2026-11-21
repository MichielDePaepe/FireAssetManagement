---
task: 20.2
title: Add YAML radio mapping and FirePlan date parsing
status: done
blocked-by: []
---
## Goal
Add the limited YAML mapping for extracting portable ASTRID radios from the driver's cabin, with timezone-aware parsing for FirePlan local timestamps.

## Context
The mapping is a small configuration for later synchronization code, not a generic mapping engine or frontend editor. Container UUIDs must be looked up from each inventory tree by exact French container name. Use `itemTypeId: 1010` and check the source type name `Radio portable Astrid`. FirePlan timestamps without offsets use Europe/Brussels.

## Acceptance Criteria
- [x] A failing test first demonstrates mapping extraction from a container tree and item list, including use of the runtime container UUID and preservation of TEI as text.
- [x] A YAML mapping file identifies `Cabine de conduite`, item type `1010`, and expected source type name `Radio portable Astrid`.
- [x] Mapping loading/extraction is implemented with tests for an unrelated container, an unrelated item type, and missing selected container behavior.
- [x] A failing test first demonstrates parsing a timestamp without an offset as Europe/Brussels and returns a timezone-aware value; explicit offsets remain respected.
- [x] No existing direct YAML parser dependency is suitable; select and add one with a documented rationale, or reuse an existing direct dependency.
- [x] The dependency and mapping/date behavior are documented in the relevant README and `ARCHITECTURE.md` or `SPEC.md`.
- [x] Relevant backend tests and lint pass, or environment limitations are recorded.

## Notes
- Added a small safe-loaded YAML mapping, runtime container resolver, radio-item extractor, and Fireplan timestamp parser in `backend/fireplan/`.
- Added direct `PyYAML` dependency; the standard library has no YAML parser. README, architecture, and dependency notes describe its purpose and the mapping/timezone contract.
- Added six tests. Red phase failed on the missing module; green phase passed. Final backend suite: 166 passed, 1 skipped (live Redis broker required); Ruff passed. Frontend: 83 passed; ESLint and TypeScript passed.
- Source TEI values that are not strings are rejected to avoid silently losing leading-zero formatting.
