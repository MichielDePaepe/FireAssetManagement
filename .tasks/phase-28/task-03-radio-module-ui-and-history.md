---
id: task-03
title: Radio-module, beheerweergaven en historiek
status: done
complexity: high
blocked-by: task-01
---
## Goal
Voeg de Radio's-module direct onder Pagers toe met beheertabbladen voor radio's, ISSI's en abonnementen.

## Context
Gebruik bestaande React/API-, modal-, tabel- en toegankelijkheidspatronen. Organisatie- en model/rangebeheer is vanuit de module bereikbaar; invoer blijft configureerbaar.

## Acceptance Criteria
- [x] Navitem Radio's staat direct onder Pagers en opent radio-, ISSI- en abonnementenweergaven.
- [x] Radio's kunnen worden gezocht op TEI, fabrikant/model, FirePlan-ID en actuele ISSI; ISSI's op nummer, alias, organisatie en radio.
- [x] Staff kan radio's, ISSI's, organisaties, modellen en TEI-bereiken aanmaken/bewerken; bronvelden zijn niet bewerkbaar.
- [x] Abonnementenweergave toont actuele en beëindigde koppelingen met begin/eindtijd; radio- en ISSI-details tonen de huidige koppeling en volledige geschiedenis.
- [x] Tabellen gebruiken vaste tabelgeometrie, expliciete kolomverdeling, toegankelijke sortering en consistente compacte headers; formulieren werken met toetsenbord en foutmeldingen.
- [x] Vitest dekt navigatie, zoeken, CRUD, lege/laad/fouttoestanden en historiek.

## Notes
- `RadioManagementPage.tsx` bevat radio-, ISSI-, abonnementen- en referentiebeheer; FirePlan-identiteit wordt alleen getoond.
- `npm test -- --run src/pages/RadioManagementPage.test.tsx src/components/AppLayout.test.tsx`: 13 tests geslaagd.
- `npx tsc --noEmit -p tsconfig.app.json` en `npm run lint` geslaagd.
