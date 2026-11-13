# Product and technical specification

## Purpose and scope

Provide a reusable GitHub template for web applications that start with a working React frontend, Django REST API, PostgreSQL database, Celery background workers, task progress, and Docker-based development and production environments.

## Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| FR-001 | The frontend uses React, Vite, strict TypeScript, Tailwind, shadcn-style components, Lucide, Sonner, cmdk, React Router, React Hook Form, and Zod. | Frontend dependencies and typed pages compile. |
| FR-002 | All interface corners are square and the app layout is responsive. | Shared Tailwind theme and global reset; responsive shell. |
| FR-003 | The backend uses Python, Django, DRF, Uvicorn, PostgreSQL, and drf-spectacular. | Compose services, API schema, and docs endpoint. |
| FR-004 | Celery uses Redis as broker, django-celery-results for task status/results, celery-progress for progress, and Flower for monitoring. | Compose services and task integration. |
| FR-005 | `make dev` starts the full environment with HMR, Django reload, Celery file-watch reload, mounted source, persistent database, and accessible logs. | Development Compose override and Make target. |
| FR-006 | `make prod` starts an optimized, restartable, health-checked deployment with persistent data, no debug mode, and no development servers exposed. | Production Compose and image targets. |
| FR-007 | Authenticated API clients can start an example task, list recent tasks, and retrieve task status/progress/result by Celery task ID. | REST routes and API tests. |
| FR-008 | Tasks execute independently of browser sessions, support concurrency, bounded retry rules, time limits, and structured logging. | Celery task configuration and tests. |
| FR-009 | The browser receives SSE progress updates, reconnects automatically, and restores progress after navigation or refresh. | Django SSE stream, EventSource client, and UI tests. |
| FR-010 | The interface contains navigation, dashboard, task overview/detail, progress, loading/error states, command palette, notifications, and reusable validated forms. | React routes and components. |
| FR-011 | A roughly 30-second example task demonstrates the complete browser/API/broker/worker/result/progress/SSE flow. | Example task defaults to 30 seconds. |
| FR-012 | Template users can configure project name, app title, Python package, Compose name, ports, and environment values. | `.env.example` and `scripts/configure_project.py`. |
| FR-013 | `make clean` requires an explicit typed confirmation before deleting persistent data. | Make target checks for `DELETE`. |
| FR-014 | GitHub Actions runs tests and lint/type checks. | CI workflow. |

## Non-functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NFR-001 | PostgreSQL is authoritative for persistent task results and progress. | Celery result backend is `django-db`; Redis is only broker. |
| NFR-002 | No credentials or production secrets are committed. | `.env` ignored; `.env.example` contains placeholders. |
| NFR-003 | Production API requires authentication and unsafe requests require CSRF protection. | Django session auth and login endpoints. |
| NFR-004 | Worker restart behavior is explicit; no unsupported claim of resuming partial work. | README and architecture recovery section. |
| NFR-005 | The project remains operable through Docker Compose and compatible with Portainer stack deployment. | Standard Compose files and environment-driven settings. |
| NFR-006 | Local-network production runs on HTTP by default; HTTPS is optional. | HTTP app port and optional Caddy Compose overlay. |
| NFR-007 | Databases and broker are reachable only inside the Compose network; published host ports are configurable per project. | Compose service network and `.env` port variables. |

## Constraints

- Use the requested languages, frameworks, and packages. `celery-progress` is the confirmed alternative to `django-celery-progress`.
- Do not use Gunicorn, Supervisor, or a custom background-task framework.
- Do not create a second task abstraction or duplicate Celery result models.
- Keep Redis as broker only; persist result/progress metadata in PostgreSQL.
- Do not add custom persistence for SSE events; stream the stored task snapshot.
- Avoid forced worker termination as a cancellation strategy.

## Confirmed decisions

- Local/LAN production uses HTTP by default; HTTPS can be added with the optional Caddy configuration.
- Production task API access is authenticated with Django sessions.
- Default title/project name/package and ports are defined in `.env.example`.
- `celery-progress` provides progress recording; `django-celery-results` provides PostgreSQL persistence.
- Worker autoreload uses Watchfiles.
- Task IDs are Celery IDs and are saved in browser local storage for convenient return to the active task.
- Production defaults to a trusted-LAN HTTP deployment; optional HTTPS uses the supplied Caddy overlay.

## Open questions

- Per-user task ownership and account provisioning are outside this single-tenant starter scope; add them before exposing it as a multi-user service.
- Production secrets, domain names, backup policy, and retention are deployment-specific and must be set by each template user.
- Cancellation remains unavailable until task-specific cooperative cancellation can be defined safely.
