---
id: task-01
title: Managed-object base and physical asset types
status: done
complexity: high
blocked-by: ~
---
## Goal
Establish the shared identity and type structure for managed objects, and represent pagers and vehicles as typed physical assets while preserving their source-specific details.

## Context
Existing pagers live in `backend/assets`; Fireplan vehicles currently live in `backend/citygis`. The approved spec requires a shared managed-object concept with explicit typed distinctions, structured type-specific data, and preservation of Fireplan ownership of vehicle fields. Keep CityGIS vectors distinct from physical vehicles.

## Acceptance Criteria
- [x] A managed object has a stable shared identity and explicit kind/type suitable for relationships to other managed objects.
- [x] Pager and vehicle records retain their existing type-specific identifiers and attributes without moving all fields into an unvalidated JSON field.
- [x] Vehicle source fields remain Fireplan-owned; pager Fireplan synchronization behavior and unique identifiers remain intact.
- [x] A vector can participate in the common relationship model without being represented as a physical vehicle.
- [x] Tests prove existing pager and vehicle records can be represented and serialized through the typed model.

## Notes
- Added `inventory.ManagedObject` and typed links for pager, Fireplan vehicle, and CityGIS vector; kept source and pager fields on their existing models.
- Added read-only managed-object identity to pager, vehicle, and vector serializers and data migrations that backfill existing rows.
- Verified 55 pagers, 229 vehicles, and 129 vectors retained IDs/source fields on the development database migration; 2 focused managed-object tests pass and Django reports no migration drift.
- The initial broader backend run exposed stale seeded-data and test-isolation assumptions; task 4 corrected them. Final backend suite passes with one live-Redis test skipped.
