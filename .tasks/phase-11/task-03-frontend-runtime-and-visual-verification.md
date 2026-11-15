---
id: task-03
title: Verify authenticated inventory and frontend delivery
status: done
complexity: high
blocked-by: task-01
---
## Goal
Verify frontend tests and build, then inspect the authenticated inventory in a browser-capable session.

## Context
This task covers phase-11 carry item 2. Verification must use the staff-facing route and the current type-driven inventory UI; a route HTTP 200 alone does not prove rendering or authentication.

## Acceptance Criteria
- [x] Frontend Vitest, ESLint, TypeScript checks, and production build pass.
- [x] The staff-facing inventory route is reached in an authenticated browser session.
- [x] Visually verify the sortable headers, separated vector and RiC/AdC columns, CityGIS status styling, toolbar placement, below-modal vector dropdown, and unavailable-choice filtering.
- [x] Record which rendered behaviors were verified and any concrete limitation; do not claim browser proof from source/tests alone.

## Notes
- Ran the authenticated staff route at `http://localhost:5174/inventory` in Chrome. The rendered vector table has CityGIS-style colored status labels and sortable columns; RiC/AdC has separate Alias, RiC/AdC, and Gekoppelde vector columns; the toolbar places object type at the upper right and search at the list's right edge.
- Opened a pager relationship dialog without saving. Searching vectors displayed compatible options below the input, extending outside the modal. Changing the pager sort reversed the visible order. The filtered dropdown and multi-link behavior are also covered by InventoryPage tests.
- Frontend checks in the Compose development container: Vitest 61 passed across 14 files, ESLint passed, TypeScript passed, and Vite production build passed. Rollup emitted two dependency annotation warnings from Zod; build completed successfully.
- Fixed the development frontend healthcheck to probe Vite on port 5173; the inherited production check incorrectly probed port 80. Recreated the frontend using the dev Compose files and verified its Docker health status is `healthy`.
- API port 8001 remains unpublished by design: backend services are private and API calls use the frontend's same-origin proxy, as documented in README and ARCHITECTURE.
