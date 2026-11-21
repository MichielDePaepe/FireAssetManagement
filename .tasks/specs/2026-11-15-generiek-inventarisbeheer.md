---
kind: extension
date: 2026-11-15
phases:
  - name: Managed-object model and migration
    goal: Introduce a reusable domain model for physical assets, operational vectors, locations, services, and typed relationships while preserving existing pager, vehicle, and RiC-code data.
    exit-criteria: |
      - Physical assets have shared base data and structured type-specific records; the first physical asset types are pagers and vehicles.
      - Vectors remain distinct operational objects with a stable identity independent of their currently assigned vehicle.
      - Locations support a simple parent-child hierarchy and an optional service association; posts are represented as locations.
      - Services are normalized records. Vectors reference their CityGIS service with a foreign key, and locations may reference a service. A vector's post is derived only when its service maps to a post location; unmatched services remain unlinked.
      - Operational assignment, observed physical location, and expected physical location are distinct concepts in the domain model. Expected location is derived from the current assignment path and current CityGIS vector-vehicle association; it is not stored as an independent fact.
      - RiC/AdC codes remain structured address records, separate from physical assets, and can be related to vectors with history.
      - Existing pager, vehicle, vector, service, and RiC/AdC data is migrated without loss or duplication.
  - name: Source synchronization and relationship history
    goal: Preserve Fireplan and CityGIS as authoritative sources for their respective data and record the history of source-managed and locally managed relationships.
    exit-criteria: |
      - Fireplan remains authoritative for vehicle identity and the vehicle fields currently imported by the application: Fireplan ID, alphacode, plate, utilisation, chassis, and fleet status.
      - CityGIS remains authoritative for vectors, their service, and the current vector-vehicle association. These source-managed values are read-only in the application.
      - The existing source identifiers and matching rules are inspected and retained or improved only when a stable source key is available; source meanings are not conflated.
      - Changes to a vector's service or vehicle association are recorded with both the source-effective time when the source provides it and the time the synchronization observed the change. Unknown source-effective times remain unknown; they are not replaced with the observation time.
      - Locally managed assets have at most one active operational assignment at a time, independently of any observed physical-location record. Prior assignments are retained with their change times.
      - Failed or incomplete source synchronization does not partially change current data or close valid historical relationships.
      - Repeated identical sync snapshots do not create duplicate history entries.
  - name: Registration and post overview
    goal: Let staff register and connect the existing assets and RiC/AdC records, and review them by post and vector.
    exit-criteria: |
      - Staff can view locations, posts, vectors, current vehicles, pagers, and RiC/AdC records in an inventory-oriented interface.
      - The primary overview is organized by post and shows its vectors, the current CityGIS vehicle for each vector, and assets and RiC codes linked to that vector.
      - Staff can link a pager to at most one vector; a vector can have multiple pagers. Staff can link a RiC/AdC record to at most one vector; a vector can have multiple RiC/AdC records.
      - The data model permits a physical asset's current operational assignment and its latest observed physical location to coexist as separate records. The expected physical location is derived and may differ from the observed location.
      - Relationships remain editable only where this application owns them. Users cannot edit CityGIS vector data, service data, or vector-vehicle assignments.
      - The shared relationship model can connect future asset types to a vector or another asset, including a vehicle, without implementing future asset types in this phase.
      - No physical inventory-check workflow, discrepancy reporting, or corrective workflow is included in this phase.
  - name: Documentation and verification
    goal: Document the domain boundaries and verify data migration, source synchronization, history, access control, and the post-oriented registration experience.
    exit-criteria: |
      - SPEC.md and ARCHITECTURE.md describe managed-object types, source ownership, service-to-post mapping, history, and the staged scope accurately.
      - README documents any required setup or operational behavior; .env.example changes only if a new environment variable is introduced.
      - Backend tests cover migration preservation, source ownership, unknown/unmapped services, one-active-assignment cardinality, separate physical-location observations, distinct source-effective and sync-observed times, history transitions, and source failures.
      - Frontend tests cover post/vector navigation, asset and RiC assignment, read-only source-managed fields, and loading/error/empty states.
      - Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.
---
## Notes

### Goal and scope

Extend Fire Asset Management into a reusable inventory register for the physical assets and operational objects already present in the application. The initial release covers pagers, vehicles, vectors, locations/posts, services, and RiC/AdC records. Keep the model ready for later asset types such as radios, trackers, tablets, intelligent cabinets, and cabinet positions/slots, each with structured type-specific data and processes. Do not implement those future types now.

The first release is for registration and relationships, not physical inventory checks. Later work may compare expected and observed contents, report discrepancies, and attach workflows to correct them. Do not build those later workflows in this extension.

### Domain model

Use one shared managed-object concept and typed distinctions rather than treating every record as an undifferentiated physical asset:

- A **physical asset** has shared base data and type-specific structured details. Vehicles and pagers are the initial physical asset types. Type-specific fields must be modeled in a way that can grow without putting all properties into an unvalidated catch-all field.
- A **vector** is a stable operational object belonging to a post. Its identity is independent of the physical vehicle currently associated with it. It participates in the same relationship model as assets but remains a distinct type with CityGIS-owned fields.
- A **location** is a place, not a physical asset. Posts, buildings, rooms, dispatching, and radio rooms can be represented in a simple location hierarchy. A physical intelligent cabinet is an asset located in a room; its slots/positions can be modeled later if they need independent identity.
- A **service** is a normalized reference record. Do not persist the vector's CityGIS service only as repeated free text.
- **RiC/AdC codes** remain address/configuration records, not physical assets. Preserve their RiC, AdC, and alias fields and model their vector association separately with history.

Relationships must identify their meaning, such as operationally assigned to, mounted in, or physically observed at. Do not hard-code assignment targets to only vectors and vehicles: a future asset may be attached to a vector, another asset, a cabinet, or a cabinet position.

For each physical asset, allow at most one active **operational assignment**. That is independent of the asset's **observed physical location**, which records where it was last actually found and may differ from its assignment. The **expected physical location** is derived from the operational assignment and current source relationships: for example, an asset assigned to a vector is expected on the vehicle CityGIS currently associates with that vector. Do not persist this derived expectation as if it were an observation. The data model must keep these concepts separate now, while physical inventory workflows for recording observations can be delivered later. Retain assignment and observation history with their respective timestamps.

### Posts, services, and vectors

CityGIS provides the vector's service. For services that identify a post, derive the vector's post by matching the vector's service record to the service associated with a post location. Some services may not identify a post; those vectors remain without a derived post. Locations do not all need a service association. Keep the location hierarchy simple and limited to places useful for inventory.

### Authoritative sources

- **Fireplan** is authoritative for vehicle data. The current integration imports Fireplan ID, alphacode, plate, utilisation, chassis, and fleet status. Use those currently available fields; do not add local vehicle fields in this phase. Additional source or locally managed fields can be considered later.
- **CityGIS** is authoritative for vectors, the service associated with each vector, and the current vehicle-to-vector association. The app accesses the existing source integration and must not expose edits to these fields or assignments.
- The current implementation fetches Fireplan vehicles and CityGIS resource records separately, using the existing configured credentials and source clients. Inspect actual source identifiers and payloads before changing synchronization. Preserve distinct meanings of CityGIS `Name`, `pResourceCode`, `ResourceCode`, service fields, and Fireplan `alphacode`.
- The application owns pager-to-vector and RiC/AdC-to-vector assignments. Those assignments are editable by staff and retain their history.

Every observed change to a CityGIS vector-service or vector-vehicle relationship must be stored so that a later report can reconstruct which service/post and vehicle were associated with a vector. For source-managed history, store separately (1) the source-effective timestamp, if CityGIS supplies a timestamp that applies to that relationship change, and (2) the time the application first observed the change during synchronization. If the source does not provide an applicable effective time, leave it unknown; never imply that the change happened exactly at the sync time. Do not reuse a vector status timestamp as the effective time of a vehicle or service change. Store changes to locally managed assignments and later physical-location observations with their own timestamps. Repeated identical snapshots must not generate redundant history. A failed/incomplete source refresh must preserve the last successful state and must not end valid history.

### Initial user experience

Organize the primary inventory view by post, with its vectors as the stable operational footprints. For each vector show the currently associated source vehicle, linked pagers, and linked RiC/AdC codes. Staff can manage pager and code relationships in this application. CityGIS and Fireplan-owned values are read-only. Include locations that do not map to a post, such as dispatching or a radio room, as locations without forcing them into the vector/post relationship.

The current source data and current relationships are the focus of the initial release. Persist operational-assignment history and source-association history so later work can reconstruct changes; a dedicated history timeline or report is not required in this phase. Keep the physical-location observation concept separate and ready for inventory work, but do not implement inventory sessions, observation-entry workflows, stock counts, expected-versus-observed comparisons, discrepancy dashboards, or resolution workflows yet.

### Future extension boundary

The shared model must allow later asset types to have their own structured details and workflows, and allow relationships between managed objects. Examples include portable radios assigned to vectors, fixed mobile radios mounted in vehicles, and equipment assigned to an intelligent cabinet or one of its positions. Implement no future asset types or cabinet-slot workflows in this extension. Keep physical inventory checking, discrepancy reporting, and corrective workflows as later project phases.
