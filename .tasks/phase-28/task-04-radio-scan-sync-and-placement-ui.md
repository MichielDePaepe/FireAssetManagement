---
id: task-04
title: Scan-, synchronisatie- en plaatsingsbediening
status: done
complexity: high
blocked-by: task-02, task-03
---
## Goal
Integreer radio-identificatie, FirePlan-sync en radiospecifieke plaatsingen in de Radio-module.

## Context
Herbruik `RadioScanLookup`, de bestaande FirePlan-taakdetail/SSE-rapportage, `ManagedRelationship.relate`-API en bestaande relatie-/locatiecatalogi.

## Acceptance Criteria
- [x] De module biedt scanbediening voor camera en toetsenbordscanner en toont radioresultaat/fout zonder relatie- of abonnementmutatie.
- [x] Staff kan synchronisatie starten; progress, resultaat en fouten zijn zichtbaar via bestaande taakschermen.
- [x] De bestaande relatiebeheerinterface laat alleen toegestane vector-, voertuig- of locatiedoelen kiezen en toont huidige/historische relaties.
- [x] FirePlan-ID/QR-URL blijven read-only en een herhaalde identieke plaatsing maakt geen extra historie.
- [x] UI-tests dekken scannen, synchronisatie, plaatsingswijziging, validatiefouten en toegankelijke bediening.

## Notes
- Frontendtests simuleren de scanner callback; de echte `RadioScanLookup`/scanner flow blijft onder de gedeelde tests van `RadioScanLookup` en `PagerScanControl`.
- Gelijke plaatsingen blijven idempotent via de bestaande backend-relatiehelper; backend-tests uit task-02 dekken dat gedrag.
- Radiosynchronisatie gebruikt de bestaande taakdetails, SSE-monitor en rapportdialoog; 41 gerichte UI/API-client tests plus ESLint en TypeScript zijn geslaagd. Browser runtime werd niet visueel gecontroleerd omdat de browser access host niet beschikbaar was.
