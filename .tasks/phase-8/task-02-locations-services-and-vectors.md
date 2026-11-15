---
id: task-02
title: Locations, services, and vectors
status: done
complexity: high
blocked-by: task-01
---
## Goal
Represent posts and other physical places in a simple location hierarchy, normalize CityGIS services, and link vectors to their service without losing their stable identity.

## Context
CityGIS provides vectors and a service value per vector. A service can identify a post location; some services do not identify a post. Locations may be nested and may optionally reference a service. The current vector model stores service as text and has no location hierarchy.

## Acceptance Criteria
- [x] Locations support an optional parent location and optional service link; posts are represented as locations.
- [x] Services are normalized records and vectors reference them by foreign key while preserving the source value needed for synchronization.
- [x] A vector's post is derived only when its service maps to a post location; unmapped services remain unlinked.
- [x] Vectors remain stable across vehicle changes and keep their source identifiers and operational status fields.
- [x] Tests cover nested locations, mapped and unmapped services, and persistence of existing vector records.

## Notes
- Added normalized CityGIS services, hierarchical locations, and optional service-location mapping; vectors retain the source abbreviation and link to services by FK.
- Vector post is derived only from a mapped post location. Migration preserved all 129 vector IDs and source service values; 2 new focused tests pass.
- An intermediate CityGIS run found a stale log-message assertion; task 4 aligned it with the current structured log. The final backend suite passes.
