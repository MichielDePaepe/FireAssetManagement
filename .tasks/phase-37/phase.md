---
phase: 37
title: Tracker- en assetoverzichten
status: pending
opened: ~
closed: ~
---
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
