# Web Project Starter

A reusable React + Django foundation with background jobs, live progress, Docker Compose, and GitHub Actions.

## Quick start

Requirements: Docker Engine/Desktop with Docker Compose v2, Git, and `make`.

```sh
make dev
```

Open the Vite app at <http://localhost:5173>. Development also starts Django/Uvicorn, Celery, PostgreSQL, Redis, and Flower. The local demo account is `starter` / `starter-dev-only`; change these values in `.env` before sharing the environment. Flower is at <http://localhost:5555>. Set `FRONTEND_PORT` and `FLOWER_PORT` in `.env` to use different host ports. Django, PostgreSQL, and Redis are reachable only by other Compose services (`api:8000`, `db:5432`, and `redis:6379` respectively); the frontend proxies API requests to Django.

The frontend proxies `/api` to Django. Source is mounted into the development containers: Vite HMR updates the browser, Uvicorn reloads Django, and Watchfiles restarts the Celery worker after Python changes. Watchfiles and Compose allow up to two minutes for a warm worker shutdown, which gives the configured 90-second task limit time to finish. If the worker is forcibly killed after that, late acknowledgement can redeliver the task from the start. The example is idempotent. Do not assume arbitrary work resumes at its previous progress point.

## Production

Copy `.env.production.example` to `.env`, set unique database credentials and a long random `DJANGO_SECRET_KEY`, and configure allowed hosts before running:

```sh
make prod
```

The app is served over plain HTTP at <http://localhost:8080> by default, suitable for a trusted local network. Set `APP_PORT` to change its host port. Django, PostgreSQL, Redis, and workers have no published host ports. Flower is opt-in and bound to loopback only; set `FLOWER_PORT` to change its host port:

```sh
docker compose --profile monitoring up -d flower
```

Set non-empty `FLOWER_USER` and `FLOWER_PASSWORD` before enabling it. Use an SSH tunnel to view it remotely. For HTTPS, `make prod-https` adds the optional Caddy proxy. Its host ports default to 80 and 443; set `HTTP_PORT` and `HTTPS_PORT` in `.env` to change them. Set `HTTPS_DOMAIN` to a DNS name that resolves to the server and `ACME_EMAIL`; normal public certificates require the domain and ports to be reachable by the certificate authority. For a LAN-only deployment, Caddy can issue a private certificate with `tls internal`, but each client device must trust Caddy's root certificate. Enable `DJANGO_SECURE_COOKIES=true` when the app is accessed through HTTPS. Keep it false for the default HTTP LAN deployment.

The app container uses Nginx to serve the compiled single-page application and proxy API/SSE requests to Django. This is the HTTP application entry point. Caddy is only needed when TLS termination is desired.

## Project customization

Run the template setup script once after creating a repository from this GitHub template:

```sh
python3 scripts/configure_project.py \
  --project-name field-operations \
  --app-title "Field Operations" \
  --python-package field_operations \
  --frontend-port 5173 \
  --app-port 8080
```

The script creates a private, ignored `.env`, renames the Django settings/Celery package, and updates the selected project title and ports. All other configuration lives in `.env`; `.env.example` documents available variables. `PROJECT_NAME` controls the Docker Compose project and `APP_TITLE` controls the browser and app title. `PYTHON_PACKAGE` is the Python package containing Django settings and the Celery app. Set each project's published host ports to distinct values in `.env` when running multiple projects on the same machine. If you change a browser-facing port or host, update `CSRF_TRUSTED_ORIGINS` to match. Keep passwords and Django secret keys out of source control. If database passwords contain URL-reserved characters, use letters and numbers or percent-encode them before placing them in `.env`.

After pushing the code to GitHub, enable **Settings → General → Template repository** in GitHub so users can create repositories from it.

## Commands

| Command | Purpose |
| --- | --- |
| `make dev` | Start the complete development environment with hot reload |
| `make prod` | Start the production HTTP stack |
| `make prod-https` | Add optional Caddy HTTPS; requires DNS and certificate configuration |
| `make stop` | Stop services and retain database and Redis data |
| `make logs` | Follow service logs |
| `make test` | Run backend and frontend tests |
| `make lint` | Run Python linting and frontend lint/type checks |
| `make migrate` | Apply Django migrations |
| `make shell` | Open the Django shell |
| `make clean` | Remove containers and persistent volumes after typing `DELETE` |

`make clean` deletes database and Redis data and cannot be undone.

## Background task flow

1. The browser POSTs to `POST /api/tasks/`; Django responds with Celery's task ID.
2. Celery publishes the task to Redis; workers execute tasks independently of browser connections.
3. `celery-progress` writes progress through Celery's result backend, configured as `django-celery-results` using PostgreSQL.
4. The browser opens `GET /api/tasks/{id}/events/`. Django streams the latest persisted snapshot as SSE, checking PostgreSQL once per second while connected. The browser's native `EventSource` reconnects after network loss; on reconnect the server sends the latest snapshot.
5. `GET /api/tasks/{id}/` retrieves a snapshot; `GET /api/tasks/` lists recent example tasks.

Task endpoints require an authenticated Django session and CSRF protection. This starter is a single-tenant workspace: authenticated users share the demonstration task list. Add task ownership before using it as a multi-user product. The example supports bounded automatic retries for `RuntimeError` and configured task limits, but it does not expose a cancel button because safe cancellation of running work needs task-specific cooperation.

Celery's database result backend stores status, progress metadata, and results; Redis is the broker and has an append-only volume. Worker shutdown is graceful by default. Late acknowledgements can redeliver a task after abrupt worker loss; this is at-least-once execution and can run work more than once. The demonstration task can safely restart from its beginning. For real work, make tasks idempotent and select retry rules deliberately. Results remain in PostgreSQL until an application-specific cleanup policy is configured; `CELERY_RESULT_EXPIRES` alone does not run cleanup without Celery Beat or another scheduled cleanup mechanism.

## API and operations

- OpenAPI schema: `/api/schema/`
- Swagger UI: `/api/docs/`
- Django admin: `/admin/`
- Development Flower: <http://localhost:5555>

The production Compose file can be deployed with Docker Compose or imported into Portainer as a Compose stack. Set its environment variables and persistent-volume policy before starting it.

Create the first production login interactively with `docker compose exec api python manage.py createsuperuser`. Do not use the development demo account in production.

## Development checks

```sh
make test
make lint
```

GitHub Actions runs the backend checks against PostgreSQL and Redis and runs frontend tests, lint, and TypeScript checks. Docker is not required by the CI workflow itself.
