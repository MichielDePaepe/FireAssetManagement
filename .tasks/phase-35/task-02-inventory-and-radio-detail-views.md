---
id: task-02
title: Inventaris- en radiodetail met historische waarnemingen
status: done
complexity: high
blocked-by: []
---
## Goal
Maak radio-waarnemingen zichtbaar en navigeerbaar vanuit zowel de FirePlan-inventarisdetailpagina als de radiodetailpagina.

## Context
`backend/fireplan/views.py` levert de inventarisdetailgegevens en `frontend/src/pages/FireplanInventoryDetailPage.tsx` rendert die. De radiodetail-API en UI zitten bij `backend/assets/` en `frontend/src/pages/RadioDetailPage.tsx`. Gebruik de bestaande routes en API-contracten.

## Acceptance Criteria
- [x] Inventarisdetail toont iedere waarneming met het ongewijzigde bronserienummer en linkt gekoppelde radio's naar hun detailpagina; niet-gematchte waarnemingen blijven herkenbaar zonder link.
- [x] Radiodetail toont alle inventarissen waarin de radio voorkomt, met inventarisdatum, link naar de inventaris en beschikbare voertuig- en vectorinformatie.
- [x] API-queries laden de benodigde relaties efficiënt en houden bestaande inventaris- en radiodetailvelden intact.
- [x] Frontendtests dekken meerdere waarnemingen, niet-gematchte items en links in beide richtingen.

## Notes
- Extended the inventory detail response with linked radio identity and the radio detail response with prefetched historical inventory, vehicle, and vector details.
- Added links in both pages and an explicit unlinked state; verified with 22 focused API tests and 22 focused frontend tests.
