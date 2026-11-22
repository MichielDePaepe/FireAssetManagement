---
id: task-01
title: Dashboardregressies, documentatie en projectchecks
status: done
complexity: high
blocked-by: ~
---
## Goal
Vul ontbrekende dashboardrandgevallen test-first aan, zorg dat productdocumentatie overeenkomt met het nieuwe startscherm en voer de beschikbare projectchecks uit.

## Context
Fase 30 leverde het postenoverzicht in `frontend/src/pages/DashboardPage.tsx` en de groeperingsfunctie in `frontend/src/lib/dashboardGrouping.ts`. De carry-forward uit fase 30 vraagt expliciet om dekking van statuscodes met twee cijfers, onbekende status, lege/fouttoestanden en de postmapping. De complete scope staat in `.tasks/specs/2026-11-22-dashboard-postenoverzicht.md`.

De gebruiker heeft het visuele akkoord daarna verder verfijnd: status is een 6 px kleurstreep zonder zichtbaar nummer, vlak naast de tekst; tekst mag afbreken maar niet afgekapt worden; Rest gebruikt maximaal 3 kolommen en de andere groepen 2; vectoren binnen een post krijgen geen onderlijntjes; sorteerwaarden en streepjes in lege cellen blijven verborgen.

## Acceptance Criteria
- [x] Frontendtests dekken alle vectorgroeperingsregels, exacte `CMD`-prioriteit, status `99`, beschikbaarheid 0/6, sortering, lege posten, niet-actuele vectoren, uitbreiding, twee-cijferstatus, onbekende status en correcte statusgeschiedenis.
- [x] Frontendtests dekken laden, lege posten/vectoren, API-fout en retry, SSE-updates en het behouden van gegevens bij verbroken liveverbinding.
- [x] Testen worden eerst toegevoegd en uitgevoerd; eventuele productcorrecties slagen daarna voor gerichte tests.
- [x] README en/of `SPEC.md` zijn bijgewerkt wanneer zij het generieke dashboard nog beschrijven; `ARCHITECTURE.md` blijft ongewijzigd als de bestaande API/SSE-datastroom klopt.
- [x] Frontend Vitest, ESLint, TypeScript en productiebuild zijn uitgevoerd; backend pytest en Python lint zijn uitgevoerd waar de benodigde omgeving beschikbaar is en anders met reden gerapporteerd.
- [x] Er zijn geen backendwijzigingen, dependencies, migraties of deploymentwijzigingen toegevoegd.
- [x] De verfijnde weergave gebruikt de rechthoekige 6 px verticale statusstreep zonder vierkant of zichtbaar nummer, met 4 px tussenruimte tot de tekst; tekst breekt af zonder ellipsen, Rest gebruikt 3 kolommen en andere groepen 2, en er zijn geen interne scheidingslijnen, sorteerwaarden of streepjes in lege cellen.

## Notes
- Added dashboard grouping/component regression coverage for type/status rules, post order, totals, expansion, line marker, empty cells/posts, API retry and SSE behavior.
- Updated README and SPEC.md for the dashboard. ARCHITECTURE.md remains accurate because the dashboard reuses existing location/CityGIS APIs and SSE.
- Frontend: 131 tests passed, ESLint passed, TypeScript and production build passed. Build emitted existing Rollup annotation warnings from Zod.
- Backend: 263 pytest passed, 1 Redis-gated Celery/SSE test skipped; forcing that optional test hung and was stopped. Ruff passed in Docker.
- No backend files, packages, migrations, or deployment settings changed.
