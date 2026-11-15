---
id: task-02
title: Fireplan and resources-service clients
status: done
complexity: high
blocked-by: ~
---
## Goal
Implement bounded, validated clients for the active Fireplan vehicle list and authenticated CityGIS resources service, reusing configured Fireplan credentials without exposing secrets.

## Context
Read `.tasks/specs/2026-11-14-citygis-module.md`. Fireplan endpoint: `GET /fr/api/charroi/vehicle/active/list`. Resources service: `POST /php/login_resources.php`, then `GET /php/vehicule_ajax.php` with `mode=resources`, `servicetype=atelier`, `version=cnd`, `lang=fr`; reuse one cookie session. Preserve each vector record and reject unrecognized response shapes.

## Acceptance Criteria
- [x] Fireplan client parses the active vehicle response and preserves `id`, `alphacode`, `plate`, `utilisation`, `chassis`, and `statut`.
- [x] Resources client logs in with the configured credentials, reuses response cookies, applies the exact query parameters, and extracts individual records without collapsing them.
- [x] Both clients use bounded timeouts, validate response shapes, and restrict redirects to the configured origin.
- [x] The resources-service base URL is configurable through Django settings.
- [x] Errors are actionable and logs contain no passwords, cookies, or other secrets.
- [x] Tests cover valid and invalid payloads, nested resource records, session cookies, parameters, timeouts/errors, and unsafe redirects.

## Notes
Hardened `citygis/client.py` and added `CITYGIS_RESOURCES_BASE_URL` with the internal default. Clients reject malformed records and origin/scheme changes; resource login and fetch share a cookie jar. Nine client tests pass; all 13 CityGIS tests pass and `makemigrations --check` reports no pending migration changes. Executed with Django's runner on SQLite because pytest is not installed and Docker is inaccessible.
