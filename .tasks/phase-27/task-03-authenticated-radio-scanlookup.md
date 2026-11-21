---
id: task-03
title: Authenticated radio QR-scanlookup
status: done
complexity: medium
blocked-by: task-02
---
## Goal
Herbruik FirePlan QR-candidate normalisatie en de bestaande scannerbediening om een gescande QR-code veilig naar een radio te vertalen.

## Context
Pagers gebruiken `fireplan_scan_candidates` en `PagerScanControl` voor camera- en toetsenbordscans. Een radioscan toont het gevonden asset en wijzigt geen relatie of abonnement.

## Acceptance Criteria
- [x] Een authenticated lookup zoekt op de opgeslagen volledige radio QR-URL en retourneert radio-identiteit zonder bronvelden te wijzigen.
- [x] Herkende AZERTY/QWERTY- en dubbele scanvarianten worden hergebruikt; onbekende scans geven een passende fout.
- [x] De radio-identificatiebediening hergebruikt de bestaande scannerervaring voor camera en toetsenbordscanner, met HTTPS/localhost-beperking voor camera.
- [x] Tests dekken login, geldige/ongeldige/ongekende scans en bevestigen dat scan geen plaatsing of abonnement verandert.

## Notes
- Added authenticated radio lookup by stored QR URL and a radio result component reusing `PagerScanControl`.
- Verification: 7 backend scan tests and 13 frontend scanner/API tests passed; backend lint/system/migration checks and frontend lint/typecheck passed.
- The scanner component is ready for integration in the phase 28 Radio module; lookup itself does not modify history.
