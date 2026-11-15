---
id: task-01
title: CityGIS Celery task and one-minute schedule
status: done
complexity: high
blocked-by: ~
---
## Goal
Make CityGIS refresh reliably through the existing Celery task stack, schedule it every minute with Celery Beat, and avoid storing a database task result for every automatic run.

## Context
Read the approved CityGIS spec and phase 5 carry-forward. Reuse `refresh_citygis`, Fireplan's encrypted credential record, the clients and reconciliation service. The production task must fetch both complete sources before writing CityGIS data. A manual invocation must still return the existing Celery task ID/result; only scheduled invocations ignore results.

## Acceptance Criteria
- [x] The registered `citygis.refresh` task reads configured Fireplan credentials, fetches Fireplan vehicles and resources vectors before synchronization, then persists refreshed cookies only after successful data refresh.
- [x] A source error leaves the last successful CityGIS snapshot intact and produces a structured error log without secrets.
- [x] Celery Beat schedules the same refresh task at a 60-second interval and sets `ignore_result` for scheduled invocations to avoid one database result row per minute.
- [x] Production and development Compose include one Beat process with appropriate database/broker dependencies and graceful restart behavior; no new scheduler package is added.
- [x] A manual task invocation uses normal Celery result persistence and returns the synchronization counts.
- [x] Tests cover task orchestration, credential errors, source failure/no CityGIS write, result options, and schedule interval.

## Notes
Made the refresh atomic across CityGIS writes and encrypted session updates; logged failures without credential values. Added Celery Beat at 60 seconds with `ignore_result` only on scheduled dispatches and a Beat service in production/development Compose. Four task tests pass; all 24 CityGIS tests pass using Django's SQLite runner with a lightweight Celery test stub. Both Compose YAML files parse successfully; Docker itself is unavailable.
