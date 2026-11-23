---
id: task-03
title: Integratieregressies, documentatie en vereiste controles
status: done
complexity: medium
blocked-by: [task-01, task-02]
---
## Goal
Dek de complete radio-inventariskoppeling af met regressies, houd projectdocumentatie feitelijk actueel en voer vereiste checks uit.

## Context
Lees `.tasks/specs/2026-11-23-fireplan-inventaris-radio-koppeling.md`. De repo-instructies vereisen backend pytest, frontend Vitest, Python lint, ESLint en TypeScript bij gedragswijzigingen, waar de lokale services beschikbaar zijn. Pas README, SPEC en ARCHITECTURE alleen aan waar de nieuwe gegevensstroom of gebruikersfunctie dat vereist.

## Acceptance Criteria
- [x] Tests dekken meerdere toestellen per inventaris, waarneming van hetzelfde radio in meerdere inventarissen, bronserienummerbehoud, niet-gematchte items, links aan beide kanten en snapshotbehoud na fout.
- [x] README.md en SPEC.md beschrijven de koppeling en detailweergaven; ARCHITECTURE.md is bijgewerkt als de feitelijke architectuur/gegevensstroom dit vereist.
- [x] Geen nieuwe dependencies, configuratievariabelen of parallelle synchronisatiearchitectuur.
- [x] Vereiste backend- en frontendtests, linting en TypeScript-checks zijn uitgevoerd waar mogelijk; overgeslagen checks vermelden de concrete reden.
- [x] `git diff --check` slaagt.

## Notes
- Documented the matching, migration, backfill, linked views, unmatched-item behavior, and failed-refresh preservation in README, SPEC (FR-045), and ARCHITECTURE.
- Full backend: 272 passed, 1 optional Redis-gated integration test skipped because it requires a live broker. Full frontend: 145 passed.
- Ruff, ESLint, TypeScript, `makemigrations --check --dry-run`, and `git diff --check` pass. No dependencies or environment variables added.
