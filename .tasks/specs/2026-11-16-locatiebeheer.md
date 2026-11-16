---
kind: extension
date: 2026-11-16
phases:
  - name: Location management API
    goal: Expose staff-only creation, editing, listing, and safe deletion of hierarchical locations using the existing location and CityGIS service records.
    exit-criteria: |
      - Existing location records and parent-child relationships are preserved.
      - Locations retain the existing post, building, room, and other kinds; a post remains a location, not a separate entity.
      - A CityGIS service can optionally be mapped to a post location; service source data remains read-only and one service maps to at most one location.
      - Parent updates reject self-parenting and cycles; service mapping is only accepted for post locations.
      - Locations with children or a mapped CityGIS service cannot be deleted.
      - Staff-only endpoints return enough location, service, vector, status, and linked vehicle data to render a post overview without allowing edits to synchronized fields.
  - name: Location tree and post overview UI
    goal: Add a dedicated Beheer → Locaties page to maintain the location hierarchy and review the CityGIS vectors and linked vehicles for each mapped post.
    exit-criteria: |
      - Staff can add a top-level location or child, edit its name, kind, parent, and eligible service mapping, and delete only eligible unlinked leaf locations.
      - The page presents a navigable hierarchy and details for the selected location; locations without a service remain usable.
      - A post detail shows its linked CityGIS service and that service's vectors, with operational status and current linked Fireplan vehicle.
      - CityGIS and Fireplan fields remain read-only; vehicles' post association is derived through the existing vector-service mapping.
      - Loading, empty, validation, and API error states are handled accessibly, with the existing square-corner component style.
  - name: Documentation and verification
    goal: Update the product and architecture documentation and verify the location-management API and user flow.
    exit-criteria: |
      - SPEC.md, ARCHITECTURE.md, and README.md describe the location-management page, service-to-post mapping, derived vehicle display, and scope boundaries accurately.
      - Backend tests cover staff access, location CRUD, parent-cycle prevention, service mapping validation, protected deletion, and post overview data.
      - Frontend tests cover hierarchy navigation, create/edit/delete behavior, post vector and vehicle display, and loading/error/empty states.
      - Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.
---
## Notes

### Goal and scope

Make the existing hierarchical locations manageable through the graphical interface. Staff need to register posts and physical sublocations, connect a post to its CityGIS service, and see which CityGIS vectors and current vehicles are associated with each post. This adds the missing management interface to the location, service, vector, and vehicle concepts already present in the project.

The first version covers location hierarchy and its read-only CityGIS overview. It does not add physical asset placement, manually assigned vehicle standpoints, intelligent cabinets or cabinet positions, inventory observations, or discrepancy workflows.

### Domain and source ownership

- Reuse `Location`; do not create a separate Post entity. A post is a location with kind `post`. Existing location kinds remain post, building, room, and other.
- Preserve the parent-child hierarchy. A post can contain buildings and rooms, and locations may remain unlinked to CityGIS.
- A post may be mapped to a normalized CityGIS `Service`. The service catalogue is populated by the existing CityGIS synchronization and is read-only in this feature. Retain the current one-to-one mapping so a service can identify at most one location.
- A vector's service remains CityGIS-owned. Its post is derived only from a CityGIS service mapped to a post location. Display a vehicle through the vector's current CityGIS vehicle link; do not store a second local vehicle-to-post association.
- Physical assets and observed/expected physical locations remain outside this UI extension. Later work can use the existing managed-object and relationship direction without making location entry depend on an inventory workflow.

### User experience

Add a dedicated **Beheer → Locaties** page. It presents a navigable location tree and a detail panel for the selected node. Staff can add a root location or child, edit a location's name, kind, parent, and (for a post) optional CityGIS service mapping, and delete an unlinked leaf location. Prevent parent cycles. Do not allow deletion when a location has children or a mapped service.

For a post, show its mapped CityGIS service and the vectors currently using that service, including each vector's operational status and linked vehicle. Keep all source-owned data read-only. Locations without a service remain in the hierarchy and are still editable.

### Architecture and verification

Reuse the existing React, Django REST Framework, session-authentication, and CityGIS integration patterns. Expose staff-only location management and post-overview API operations; do not add dependencies, a second location model, or a new synchronization process. Update `SPEC.md`, `ARCHITECTURE.md`, and the README if the new UI/API behavior changes their descriptions. Cover the stated API and interface behavior with the repository's normal backend and frontend checks.
