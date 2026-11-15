---
id: task-01
title: Inventory snapshot API and staff-managed relationships
status: done
complexity: high
blocked-by: ~
---
## Goal
Expose a staff-only inventory snapshot and API operations for assigning pagers and RiC/AdC records to vectors while preserving relationship history and source ownership.

## Context
`ManagedRelationship` is the shared relationship model for physical assets and operational objects; it already enforces one active operational assignment per source and supports typed managed objects. `RicCodeVectorRelationship` stores one active vector link per code with history. CityGIS provides read-only vectors, services, and vehicle links; Fireplan provides read-only vehicle data. Post locations are derived from a vector's service when that service maps to a post. Unmapped vectors remain without a post.

## Acceptance Criteria
- [x] An authenticated staff-only inventory API returns locations and posts, vectors with their current read-only service/vehicle projection, pagers with active vector assignments, and RiC/AdC records with active vector links.
- [x] Staff can assign or unassign a pager to a vector using the shared relationship model; reassignments close the prior relationship, repeated assignments are idempotent, and invalid object kinds are rejected.
- [x] Staff can assign or unassign a RiC/AdC record to a vector using its history model; reassignments close the prior link, repeated assignments are idempotent, and a code has at most one active vector.
- [x] API validation never permits edits to CityGIS vector/service/vehicle values or Fireplan vehicle values.
- [x] API tests cover access control, snapshot content including unmapped services, assignment transitions/cardinality, invalid input, and source-field read-only behavior.
- [x] No physical location observation, discrepancy, or inventory-check workflow is added.

## Notes
- Added staff-only `GET /api/inventory/` with locations, source-read-only vector projections, and current pager/RiC links; added PUT relation endpoints for assigning, moving, and unassigning pagers and codes.
- Pager links use the shared `ManagedRelationship`; RiC links use `RicCodeVectorRelationship`. Relation input is strict, so source fields cannot be passed to these endpoints.
- Six API tests pass; 23 inventory and CityGIS view tests pass. Ruff, formatting, Django checks, and migration drift checks pass. No new model or migration was needed.
