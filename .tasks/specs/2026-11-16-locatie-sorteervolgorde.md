---
kind: extension
date: 2026-11-16
phases:
  - name: Location sort order
    goal: Allow staff to influence the location tree order with an optional sort name, while keeping the field hidden under collapsed advanced options by default.
    exit-criteria: |
      - Locations with a sort name come first, ordered alphabetically by sort name and then by location name; blank sort names come last and fall back to location name.
      - Staff can create and edit the sort name in a collapsed-by-default advanced section.
      - API, model migration, frontend, tests, and relevant documentation agree on the behavior.
---
## Notes
The sort name is local location-management data, separate from CityGIS service-owned fields. It must be optional and backward compatible. Use Dutch locale-aware, case-insensitive, numeric-aware ordering and a stable ID tie-breaker in the location tree.
