---
id: task-01
title: FirePlan-radio-contract bevestigen
status: done
complexity: medium
blocked-by: ~
---
## Goal
Leg de actuele FirePlan QR-respons vast en stem TEI-validatie af op de waargenomen `serialNumber`-waarden zonder bronwaarden te transformeren.

## Context
Een live read-only ophalen op 2026-11-21 gaf 733 records voor `Radio mobile Astrid` en `Radio portable Astrid`; `Portable ATEX` gaf geen records. ID's waren uniek, kwamen overeen met de ID in de QR-data en een onmiddellijke tweede fetch gaf dezelfde respons. Serienummers waren strings: 732 gevuld, 1 ontbrekend, meestal 14 cijfers en soms 15.

## Acceptance Criteria
- [x] De synchronisatiecontract-notitie en tests leggen de bevestigde velden, naamcategorieën, numerieke ID, QR-URL en afwijkende serienummerlengtes vast zonder recordwaarden of credentials te loggen.
- [x] TEI blijft onveranderde unieke tekst en accepteert de bevestigde 14- en 15-teken hex/numerieke vormen; onbekende of ongeldige waarden blijven veilige sync-fouten.
- [x] TEI-rangevergelijking en overlapvalidatie werken numeriek over waarden met behoud van leading zeroes.

## Notes
- Live read-only source check: 733 records; names were 199 `Radio mobile Astrid` and 534 `Radio portable Astrid`; `Portable ATEX` returned none.
- All source IDs were positive integers unique within the snapshot and matched the numeric ID embedded in QR URLs. An immediate repeat returned identical records; this confirms repeat-read consistency, not a historical provider guarantee.
- `serialNumber` was a string on all records: 704 values had 14 digits, 26 had 15 digits, 2 other lengths, and 1 was missing. The exact string is retained. Mapping source names to applications is implemented with import in task 02.
- Widened local TEI/range validation to 14 or 15 hex characters and numeric comparisons; leading zeroes remain stored.
- Verification: 6 source-width/range tests passed; migration generated. Full task checks follow after task implementation.
