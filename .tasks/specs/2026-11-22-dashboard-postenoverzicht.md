---
kind: extension
date: 2026-11-22
phases:
  - name: Postenoverzicht op het dashboard
    goal: Replace the generic dashboard with a read-only, live overview of current vectors grouped by post, operational type, and high status code.
    exit-criteria: |
      - The dashboard no longer shows example-task controls, task metrics, or recent-task panels; the existing task pages remain available.
      - The page lists every location of kind `post`, ordered by its configured `sort_name` and then name, including posts with no current vectors.
      - Current CityGIS vectors are joined to posts through their existing service mapping and displayed with the linked vehicle alphacode and vector abbreviation.
      - The asset columns are APM, AE, AMB, Rest, and Status 90+, alongside the Post column. APM accepts only type `APM`; AE accepts only `AE`; AMB accepts `AMB` and `AMBINC`; `AE64` belongs to Rest.
      - Numeric operational status codes 90 or higher go to Status 90+, except code `99`. Code `99` goes to Rest regardless of vector type.
      - Rest order is exact type `CMD`, exact type `MSERV`, exact type `FAUB`, all status-99 vectors, then other Rest vectors ordered by type and a stable vehicle/vector key. `CMDSEM`, `CMDCSD`, and `CMD_*` are not treated as exact `CMD`.
      - Each type cell shows at most three rows before expansion. APM, AE, AMB, and Status 90+ use two columns; Rest uses five. An accessible expand/collapse control reveals all remaining vectors in that cell.
      - Each vector shows the vehicle alphacode prominently, the vector abbreviation beneath it in muted text, and a square status control to its left. The control accommodates two-digit codes, uses the CityGIS status color, and selects black or white text for contrast. Missing or unknown status is shown neutrally with `?`.
      - Clicking a status opens the existing CityGIS status-history dialog for that vector. No new history model, endpoint, or dialog is introduced.
      - Column totals use `available/total`, where available means status code `0` or `6`. Group membership and counts update from current data rather than hardcoded sample totals.
      - The page uses `GET /api/locations/`, `GET /api/citygis/`, and the existing CityGIS SSE stream. It keeps the last good snapshot visible if the stream disconnects and shows the existing refresh/connection timestamp or state.
      - The table preserves stable column geometry and the agreed app style. It remains usable at narrow widths through horizontal overflow; loading, empty, permission, and error states are accessible.
      - The implementation adds no backend endpoint, migration, dependency, write operation, or new synchronization/task mechanism.
  - name: Dashboard verification and documentation
    goal: Verify the dashboard behavior with the repository's normal checks and update user-facing documentation to describe the new home page.
    exit-criteria: |
      - Frontend tests cover post/vector grouping, the exact type and status-99 rules, priority ordering, availability ratios, three-row expansion, unknown status, and status-history opening.
      - Frontend tests cover loading, empty posts/vectors, API failure, SSE updates, and disconnected/stale data behavior.
      - Backend pytest, frontend Vitest, Python lint, frontend ESLint, and TypeScript checks are run where services are available; unavailable checks are reported with their reason.
      - README and `SPEC.md` are updated if their description of the Dashboard is no longer accurate. `ARCHITECTURE.md` is changed only if the implemented data flow changes its current facts.
      - No database migration or deployment change is required.
---
## Notes

The approved standalone mockup is a design reference only; it is not part of the application and does not need to ship. The mockup used a development-database snapshot of 10 posts and 110 current vectors. These figures are illustrative and must be calculated from live data in the dashboard.

Use the existing staff-facing data paths: `api.listLocations()` for post locations, `api.getCityGIS()` for the current CityGIS snapshot, and `subscribeToCityGIS()` for updates. Group vectors by their nested post/service mapping; do not create another post or vehicle relationship. Use `CityGISStatusHistoryDialog` and `api.getCityGISVectorStatusHistory()` for the status click. Keep the existing staff-only API permissions and read-only source ownership.

The status-99 rule takes precedence over type grouping and Status 90+. Such vectors appear in Rest after the exact `CMD`, `MSERV`, and `FAUB` priorities and before the remaining Rest types. Exact type checks matter: `AE64` stays in Rest, and only exact type `CMD` receives the first Rest priority.

Do not add post drill-down, asset editing, search/filter controls, or manual CityGIS write operations in this extension. The dashboard remains an overview; later work may add post details. The existing CityGIS data stream and history behavior are sufficient, so the feature should not change backend architecture or add dependencies.
