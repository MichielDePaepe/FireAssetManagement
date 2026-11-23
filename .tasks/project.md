---
title: Fire Asset Management
status: done
current-phase: 34
repo: private
github: ~
created: 2026-11-14
---
## Goal
Add a staff-managed label-printer module to the pager asset application. Initially support the Brother PT-P900W over the network, including connection checks and a configurable-width text test label, while keeping printer records suitable for adding other printer brands later.

## Phases
- [x] Phase 1: Printer management
- [x] Phase 2: Connection checks and test labels
- [x] Phase 3: Fireplan pager sync backend
- [x] Phase 4: Sync controls, progress, and report
- [x] Phase 5: CityGIS domain and source synchronization
- [x] Phase 6: Scheduled and live data delivery
- [x] Phase 7: CityGIS page and project documentation
- [x] Phase 8: Managed-object model and migration
- [x] Phase 9: Source synchronization and relationship history
- [x] Phase 10: Registration and relationship management
- [x] Phase 11: Documentation and verification
- [x] Phase 12: Location management API
- [x] Phase 13: Location tree and post overview UI
- [x] Phase 14: Documentation and verification
- [x] Phase 15: Location sort order
- [x] Phase 16: Pager scanlookup
- [x] Phase 17: Reusable scan controls
- [x] Phase 18: Pager scan flows
- [x] Phase 19: Verification and documentation
- [x] Phase 20: FirePlan-contract en mapping
- [x] Phase 21: Opslag en Celery-synchronisatie
- [x] Phase 22: Beheerinterface
- [x] Phase 23: Verificatie en documentatie
- [x] Phase 24: Lokale inventarisdetailpagina
- [x] Phase 25: Gerichte hersynchronisatie en afronding
- [x] Phase 26: Radiodomein en relatiehistoriek
- [x] Phase 27: FirePlan-synchronisatie en radio-identificatie
- [x] Phase 28: Radio-, ISSI- en abonnementenbeheer
- [x] Phase 29: Documentatie en verificatie
- [x] Phase 30: Postenoverzicht op het dashboard
- [x] Phase 31: Dashboardverificatie en documentatie
- [x] Phase 32: Postdashboardgegevens
- [x] Phase 33: Postdashboardinterface
- [x] Phase 34: Verificatie en documentatie

## Specs
- specs/2026-11-13-labelprinter-module.md (bootstrap) → phases 1-2
- specs/2026-11-14-fireplan-pager-synchronization.md (extension) → phases 3-4
- specs/2026-11-14-citygis-module.md (extension) → phases 5-7
- specs/2026-11-15-generiek-inventarisbeheer.md (extension) → phases 8-11
- specs/2026-11-16-locatiebeheer.md (extension) → phases 12-14
- specs/2026-11-16-locatie-sorteervolgorde.md (extension) → phase 15
- specs/2026-11-16-qr-asset-scanning.md (extension) → phases 16-19
- specs/2026-11-21-fireplan-inventarissynchronisatie.md (extension) → phases 20-23
- specs/2026-11-21-fireplan-inventaris-detailpagina.md (extension) → phases 24-25
- specs/2026-11-21-radiobeheer.md (extension) → phases 26-29
- specs/2026-11-22-dashboard-postenoverzicht.md (extension) → phases 30-31
- specs/2026-11-23-postdashboard-per-post.md (extension) → phases 32-34
