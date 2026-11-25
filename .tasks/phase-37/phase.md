---
phase: 37
title: Tracker- en assetoverzichten
status: open
opened: 2026-11-25
closed: ~
---
## Carry from phase 36
1. Suivo account OAuth was confirmed on 2026-11-25: 200 units, 182 devices, 8 without a unit, two device types, and 200 matching unit-status rows. 195 rows had `last-seen`, 193 had a position, and no battery-named status field appeared in the sample. Unlinked `/devices` rows exposed only identity/type fields. Recheck availability during phase 39; do not claim unavailable fields as present.
2. Live payloads use numeric `@id`, device `@imei`, and nested unit objects. Keep support for these actual response shapes when mapping identifiers.

## Open follow-ups from phase 36
- Optional Redis-gated Celery/SSE integration test from phase 35 remains unverified because no live broker test was run.

## Goal
Toon alle Suivo-assets en devices in twee overzichtstabellen en koppel Suivo-units automatisch aan FAM-voertuigen op naam.

## Exit Criteria
- De hoofdnav bevat **Trackers** met tabs **Assets** en **Trackers**. Assets toont Suivo-units; Trackers toont devices van het account, inclusief devices zonder gekoppelde unit en met hun werkelijke type.
- Een unit koppelt uitsluitend bij exacte overeenkomst van namen na trimmen en case-normalisatie. Geen-match en meerdere matches zijn zichtbaar en worden niet automatisch gekoppeld.
- Asset- en trackertabellen tonen beschikbare FAM/Suivo-relatie, device-identiteit, laatst gehoord, beschikbare batterijgegevens en laatste positie/locatie waar de API die levert.
- De UI onderscheidt `last-seen` van de tijd van de laatste positie, onderscheidt batterijniveau van batterijspanning en toont ontbrekende waarden zonder abonnementsstatus af te leiden.
- De tabellen volgen de toegankelijke, doorzoekbare en sorteerbare tabelstijl van `AGENTS.md`, met laad-, lege-, fout- en verouderde-data-toestanden.
- De pagina blijft read-only voor Suivo. FAM kan geen devices verplaatsen, units wijzigen of lokale trackerplaatsingen aan voertuigen/locaties vastleggen.

## Tasks
- [ ] task-01-tracker-read-api-and-exact-vehicle-matching.md
- [ ] task-02-tracker-overview-page-and-tables.md
- [ ] task-03-tracker-ui-regressions-and-verification.md
