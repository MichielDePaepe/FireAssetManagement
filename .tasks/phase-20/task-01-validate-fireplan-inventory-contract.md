---
task: 20.1
title: Validate FirePlan inventory contract
status: done
blocked-by: []
---
## Goal
Verify the current FirePlan closed-inventory list and detail responses and record what `updatedAt` means for changes to a closed inventory.

## Context
Use the already authenticated FirePlan client and the read-only endpoints described in `.tasks/specs/2026-11-21-fireplan-inventarissynchronisatie.md`. Do not alter FirePlan data to provoke a change. The inventory UUID is the stable key; container and item UUIDs are per-inventory. Phase 21 needs evidence about safe detail-fetch selection.

## Acceptance Criteria
- [x] A real current list response confirms pagination and the presence and shape of `uuid`, `closedAt`, `createdAt`, `updatedAt`, `vehicleAlphaCode`, and source status fields.
- [x] A real current detail response confirms the container tree fields and item-list fields, including `itemTypeId`, item ID, and tracked serial number.
- [x] The mapping inputs are confirmed: container selected by exact French name `Cabine de conduite`, radio by `itemTypeId: 1010`, with the returned type name checked for readability.
- [x] `updatedAt` change behavior is supported by observed before/after evidence or is explicitly marked unconfirmed; if unconfirmed, document that automatic hourly sync must not fetch every detail tree.
- [x] Evidence and any limitations are recorded in this task's Notes for phase 21.

## Notes
- Read-only live check through the authenticated local FirePlan session on 2026-11-21: list returned `records` and integer `total` (3163); `first=0,rows=10` and `first=10,rows=10` returned distinct pages.
- List records had string UUID, timestamps, and vehicle code; source completion flags were booleans and the missing-count field was integer. `closedAt`, `createdAt`, and `updatedAt` were naive ISO local timestamps (`YYYY-MM-DD HH:MM:SS`), with no offset.
- A live detail tree returned nodes with `id`, `parentId`, `nameFr`, and `nameNl`; exact `nameFr == "Cabine de conduite"` matched once. Its item endpoint returned `records`/`total`; the checked radio row used `itemTypeId=1010`, name `Radio portable Astrid`, string item ID, and string TEI.
- `updatedAt` change semantics remain unconfirmed: the read-only observation did not mutate a closed inventory or provide historical before/after evidence. Phase 21 must not treat it as a reliable change detector or fetch every detail tree hourly; record this limitation in the automatic-sync design.
- No credentials, record UUIDs, personal names, or serial values were retained in the notes.
