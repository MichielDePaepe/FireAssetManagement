---
id: task-01
title: Suivo-overzichts-API en exacte voertuigmatches
status: done
complexity: high
blocked-by: []
---
## Goal
Expose read-only asset and tracker lists with exact, ambiguity-safe FAM vehicle matching.

## Context
Use `SuivoUnit`, `SuivoDevice`, `SuivoSyncState`, and current CityGIS `Vehicle` records. Suivo responses may use numeric `@id`, `@imei`, and nested unit objects. CityGIS vehicle names are `Vehicle.alphacode`.

## Acceptance Criteria
- [x] Staff-only GET endpoints expose Suivo units and all devices, including devices without a unit; no Suivo write endpoint is added.
- [x] Unit matching trims outer whitespace and compares case-insensitively against current vehicle names; it does not use fuzzy or partial matching.
- [x] No match and multiple exact matches are represented explicitly; only one exact match is linked.
- [x] Responses preserve device type, unit/device identifiers, last-seen, independent position timestamp/location, and explicit battery level/voltage only when supplied.
- [x] Missing telemetry remains null/unavailable and never implies subscription status.
- [x] API tests cover permissions, exact/none/multiple matching, actual payload shapes, and missing telemetry.

## Notes
- Added staff-only `/api/suivo/assets/` and `/api/suivo/devices/` endpoints with exact normalized `Vehicle.alphacode` matching and explicit ambiguity states.
- Focused API tests pass for exact, missing and multiple matches, unlinked devices, actual Suivo field names, and separate optional battery values.
