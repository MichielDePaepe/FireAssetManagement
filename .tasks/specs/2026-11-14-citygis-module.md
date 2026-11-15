---
kind: extension
date: 2026-11-14
phases:
  - name: CityGIS domain and source synchronization
    goal: Rework the unverified CityGIS prototype into tested domain models, source clients, status catalog, and safe synchronization for Fireplan vehicles and individual resources-service vector records.
    exit-criteria: |
      - Physical Fireplan vehicles, dispatch vectors, and vector status definitions are stored as separate records.
      - Fireplan's active vehicle list and the authenticated resources service are fetched using the configured Fireplan credentials; secrets remain encrypted and are never returned to the browser.
      - Each vector record preserves its own source identifiers, raw string status code, LastStatusTimeUpdated timestamp, and source vehicle name; ResourceCode and pResourceCode remain distinct.
      - The status migration imports all 17 rows from the supplied image using only code, description, abbreviation, and color; other image columns are excluded.
      - Vehicle linking compares vector Name with Fireplan alphacode. An unmatched vector remains unlinked. When multiple vector records match one vehicle, the first record in source order is linked and each duplicate match is recorded as an error in structured logs.
      - A source failure prevents partial synchronization. After a complete successful sync, records missing from their respective source are retained and marked as no longer reported; a later reappearance marks them current again.
      - Tests cover source payload parsing, timestamps, status values, matching, duplicate logging, missing-record marking, and failed/incomplete fetch behavior.
  - name: Scheduled and live data delivery
    goal: Run the synchronization every minute through Celery Beat and expose a staff-only snapshot and SSE stream that reflect saved data changes.
    exit-criteria: |
      - A Celery Beat process is added to the existing Compose deployment and schedules the CityGIS refresh at a one-minute interval without adding another broker, result model, or event bus.
      - Scheduled runs do not create an unbounded stream of persisted task results. A user-requested manual run uses the same Celery task and existing task-ID/result infrastructure.
      - Authenticated staff can retrieve the current snapshot and start a manual refresh; other users cannot access CityGIS data or trigger refreshes.
      - The SSE snapshot includes vehicles, vectors, status catalog, and each vector's current vehicle association. It emits changes after a successful sync, including new vehicles, new vectors, status changes, and changed associations.
      - SSE uses the existing transport and database polling pattern. A source failure leaves the last successful snapshot intact and is logged.
      - Tests cover access control, manual task creation, snapshot serialization, SSE change delivery, and scheduled-task configuration.
  - name: CityGIS page and project documentation
    goal: Add a staff-facing page for current vectors, linked vehicles, and operational status, and document the integration and its runtime requirements.
    exit-criteria: |
      - The page displays a searchable vector list with linked vehicle/fleet details and operational status code, description, and supplied color.
      - The page updates from SSE without a browser refresh and provides a manual synchronization button that queues the same Celery task.
      - Loading, empty, disconnected, and source-error states are understandable; the last successful data snapshot remains visible during source errors.
      - README, ARCHITECTURE.md, SPEC.md, and .env.example describe the resources-service base URL, one-minute Celery schedule, SSE behavior, and authentication/credential reuse.
      - Frontend tests cover initial loading, error/disconnection states, displayed status colors, live snapshot updates, and manual refresh behavior.
      - Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks pass, or any unavailable check is reported with its reason.
---
## Notes

### Goal and scope

Add a CityGIS module to Pager Asset Management to show operational dispatch vectors, their associated physical fleet vehicles, and current vector status. Treat CityGIS files already present in the working tree as an unverified prototype: inspect them critically and replace or correct them as needed. Do not assume they were tested or that their current behavior is approved. Preserve unrelated existing work.

The first release is read-only apart from synchronization. Pager codes and pager assets are not linked to vectors in this scope. Do not add CityGIS write operations or a separate event bus/task framework.

### Sources and records

Fireplan supplies active physical vehicles through `GET /fr/api/charroi/vehicle/active/list`. Store the Fireplan vehicle ID, `alphacode`, plate, utilisation, chassis, and fleet `statut`. Fleet status is distinct from a vector's operational status.

The resources service supplies dispatch vectors. Log in with the configured Fireplan username/password using `POST /php/login_resources.php`, then fetch `GET /php/vehicule_ajax.php` with `mode=resources`, `servicetype=atelier`, `version=cnd`, and `lang=fr`, reusing the login HTTP session and cookies. The resource-service base URL is configurable. In each record, `Name` is the vehicle designation, `pResourceCode` is the vector code, `ResourceCode` is a separate vehicle-record code, and the `p...` fields carry vector name, abbreviation, service abbreviation, and type. Preserve these meanings and do not collapse multiple vector records into one by selecting a numerically highest status.

Link a vector to a Fireplan vehicle by comparing trimmed, case-insensitive `Name` and `alphacode` values. Keep each source vector record independently. If more than one vector record maps to the same vehicle, link the first matching record in source order, retain the other vector records without that vehicle link, and log the duplicate as an error with enough context to identify the vehicle and vector records. Do not silently discard a vector.

Fetch and validate both source datasets before applying changes so a network or parsing failure cannot make a partially refreshed database look current. On a complete successful refresh, update each record's last-seen/current marker. Retain records missing from their source and mark them as no longer reported; do not delete them. If they reappear, mark them current again.

### Status catalog

Seed all 17 status rows from the supplied CityGIS screenshot. Import only its first, second, third, and last columns: status code, description, abbreviation, and color. Preserve codes as strings, including `15` and `90`–`99`. Do not import the availability, auxiliary status, transport status, GPS level, or active columns.

The catalog descriptions, abbreviations, and colors are reference data and should be editable by a future migration if the source table changes. Vector records preserve their raw `StatusCode` as a string and the parsed `LastStatusTimeUpdated` independently; the user-facing description/color is resolved from the local catalog. Unknown status codes remain stored and display as unknown rather than being discarded.

### Scheduling, API, and live updates

Use the existing Celery, Redis, PostgreSQL task-result backend, authenticated API, and SSE mechanisms. Add Celery Beat as one deployment process and schedule the CityGIS synchronization every minute. Do not add `django-celery-beat` or another dependency unless the built-in Celery scheduler cannot meet the requirement; explain and document any necessary dependency before adding it. Scheduled executions should not accumulate one persisted task-result row every minute. A manual refresh from the page queues the same task through the existing Celery task-ID flow.

The staff-only API returns vehicles, vectors with their current vehicle association, the status catalog, and refresh information. The SSE stream emits the same complete snapshot when it changes. It must reflect new vehicle/vector records and changed vehicle associations as well as status changes. Keep the existing SSE transport and database-polling behavior; do not add a second event log or broadcast system. A source error must leave the last successful records visible and must be visible in logs/UI state.

### User interface and verification

Add a CityGIS navigation page using existing shared UI components and square corners. Show a searchable vector table with vector identity, service/type, linked vehicle and fleet status, operational status with its catalog color, and status timestamp. Show a last-refresh indicator and status catalog. Include a manual refresh action that queues the normal Celery task. Apply SSE updates in place without a browser refresh, including newly arrived vehicle-to-vector links. Keep the last good snapshot visible if the next scheduled source request fails.

This is a local integration against internal endpoints without public API documentation. Keep host configuration outside code, reuse the existing encrypted Fireplan credential record, validate response shapes, use same-origin redirects/cookie handling where appropriate, set bounded network timeouts, and emit structured logs without logging passwords, cookies, or other secrets.
