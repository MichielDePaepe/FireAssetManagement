---
phase: 32
task: 1
title: Postoverzichtgegevens en 24-uurs statusperioden
status: done
blocked-by: []
---
## Goal
Breid de bestaande staff-only postoverzichtsaanvraag uit met actuele fysieke assetkoppelingen en volledige statusperioden voor het laatste vaste 24-uursvenster.

## Context
Gebruik de bestaande `/api/locations/{id}/overview/`-aanvraag, CityGIS-statushistoriek en `ManagedRelationship`. Pagers worden via hun actieve `assigned_to`-relatie aan vectors gevonden; radio's via hun actieve vectorplaatsing. Toon geen RiC/AdC-codes. Kies één `now` per aanvraag, gebruik `source_effective_at` met `observed_at` als terugval, knip periodes op beide venstergrenzen en vul statusloze gaten als onbekend aan. Haal alle benodigde historie op zonder de afzonderlijke endpointlimiet van 50.

## Acceptance Criteria
- [x] De postresponse bevat de post, alle actuele vectors, voertuigen en per vector de momenteel toegewezen pagers en radio's.
- [x] Alleen actieve pager-toewijzingen en actieve radioplaatsingen naar vectors worden getoond; RiC/AdC-relaties ontbreken.
- [x] Per vector bevat de response statussegmenten die het volledige laatste 24-uursvenster afdekken, met expliciete onbekende gaten.
- [x] Segmenttijden gebruiken bron-effectieve tijd of anders waarnemingstijd, zijn chronologisch en worden geknipt aan de venstergrenzen.
- [x] De endpoint haalt meer dan 50 records per vector op indien nodig en blijft staff-only.
- [x] Backendregressietests dekken actieve/inactieve assetrelaties, historiegrenzen, ontbrekende tijd en >50 records.

## Notes
- Uitgebreid `/locations/{id}/overview/` met per vector `pagers`, `radios` en `status_periods`; response bevat ook één gedeeld `status_window`.
- Statusintervallen worden aan een vaste 24-uursgrens geknipt, gaten worden onbekend en historie wordt zonder limiet geladen.
- Backendtests: gericht 8/8 geslaagd; Ruff voor gewijzigde backendbestanden geslaagd. Geen migraties of dependencies.
