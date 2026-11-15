---
id: task-02
title: Type-driven inventory and relationship manager
status: done
complexity: high
blocked-by: task-01
---
## Goal
Replace the crowded post-card overview with a type-driven object list and focused relationship modal.

## Context
Use the phase-10 inventory API. Staff first choose Pagers, Vectors, or RiC/AdC, then search and select one object from a compact list. The selected object's compatible relationships open in a modal. A pager or RiC/AdC record has at most one vector, so use a searchable single choice. A vector can have multiple pagers and RiC/AdC records, so use two searchable columns with available options on the left and linked options on the right. From the object list, staff must be able to start from any of the three current types. Keep CityGIS and Fireplan fields read-only. Structure the type and relation definitions so future types can be registered without changing the shared modal pattern; do not add radio/tracker records or new relationship semantics in this task. Use existing React, Tailwind, and shadcn-style components with square corners.

## Acceptance Criteria
- [x] Staff can choose Pagers, Vectors, or RiC/AdC and search a CityGIS-style compact sortable table; every column sorts ascending/descending with accessible state; vector, service, post, vehicle, and status use separate aligned columns; RiC/AdC shows alias, both codes, and linked vector; selecting an object opens an accessible relationship modal.
- [x] Pager and RiC/AdC modals use a searchable single-vector choice, can move to a different vector, and can clear the relationship.
- [x] Pager/RiC relationship modals fit their content without modal scrolling; the taller searchable vector dropdown is portaled below and outside the modal.
- [x] Vector modals show searchable two-column available/linked lists for pagers and RiC/AdC codes; staff can add and remove multiple links.
- [x] All three object types provide a path to the same relationships in either direction, with immediate refresh and clear save/error feedback.
- [x] CityGIS and Fireplan fields remain read-only; location/post, service, current vehicle, and status remain available as concise context.
- [x] Loading, errors, empty object lists, and empty relationship columns are accessible and understandable.
- [x] Searchable result lists show enough options to scan without repeatedly paging and omit vectors that cannot be newly assigned.
- [x] Tests cover type selection, search, modal opening/dismissal, each relationship direction/cardinality, source read-only fields, and failure/empty states.
- [x] No future asset type or physical inventory workflow is implemented; current type and relation choices are localized for later additions.

## Notes
- Reopened after user feedback that the first page layout was too cluttered. New layout: object-type selector, compact searchable list, and type-aware relationship modal.
- Modal behavior is intentionally cardinality-aware: pager/code to vector is single-choice; vector to pager/code is a pair of searchable available/linked lists.
- Matched the inventory list's compact header and row styling to CityGIS, increased visible result heights, and hid inactive vectors from new link choices while retaining an existing inactive link for unlinking.
- Updated README, SPEC, and ARCHITECTURE to describe the type-driven workflow. Frontend: 61 tests passed; ESLint, TypeScript, and production build passed.
- Live authenticated browser screenshot remains unverified because the browser tool could not bind the existing Chrome tab; carry this to phase 11.
- Vector columns now keep service, post, vehicle, and status separate; RiC/AdC columns show alias, both codes, and linked vector. Table sorting follows CityGIS controls and the vector status uses its color marker.
- Search stays on the right side of the titled toolbar. Single-link dialogs fit their content; vector choices open in a larger portal list below and outside the dialog.
- Full frontend suite: 61 passed; ESLint, TypeScript, and production build passed. Live authenticated browser screenshot remains unverified; carry this to phase 11.
