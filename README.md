# Fire Asset Management

Fire Asset Management is a web application for managing operational assets and records, built on a reusable React + Django foundation with background jobs, live progress, Docker Compose, and GitHub Actions.

## Quick start

Requirements: Docker Engine/Desktop with Docker Compose v2, Git, and `make`.

```sh
make dev
```

Open the Vite app at <http://localhost:5174>. Development also starts Django/Uvicorn, Celery, PostgreSQL, Redis, and Flower. The local demo account is configured by `DEMO_USERNAME` and `DEMO_PASSWORD` in `.env` (this checkout uses `pager-admin`); change these values before sharing the environment. Flower is at <http://localhost:5556>. Set `FRONTEND_PORT`, `FLOWER_PORT`, and `APP_PORT` in `.env` to choose host ports. These defaults avoid common Vite and Flower ports used by other local projects. If you run multiple checkouts at once, assign each a unique value for every published host port in its `.env`. Django, PostgreSQL, and Redis are reachable only by other Compose services (`api:8000`, `db:5432`, and `redis:6379` respectively); the frontend proxies API requests to Django.

The frontend proxies `/api` to Django. Source is mounted into the development containers: Vite HMR updates the browser, Uvicorn reloads Django, and Watchfiles restarts the Celery worker after Python changes. Watchfiles and Compose allow up to two minutes for a warm worker shutdown, which gives the configured 90-second task limit time to finish. If the worker is forcibly killed after that, late acknowledgement can redeliver the task from the start. The example is idempotent. Do not assume arbitrary work resumes at its previous progress point.

## Production

Copy `.env.production.example` to `.env`, set unique database credentials, a long random
`DJANGO_SECRET_KEY`, a generated `FIREPLAN_CREDENTIAL_KEY`, and configure allowed hosts before
running:

```sh
make prod
```

The app is served over plain HTTP at <http://localhost:8081> by default, suitable for a trusted local network. Set `APP_PORT` to change its host port. Django, PostgreSQL, Redis, and workers have no published host ports. Flower is opt-in and bound to loopback only; set `FLOWER_PORT` to change its host port:

```sh
docker compose --profile monitoring up -d flower
```

Set non-empty `FLOWER_USER` and `FLOWER_PASSWORD` before enabling it. Use an SSH tunnel to view it remotely. For HTTPS, `make prod-https` adds the optional Caddy proxy. Its host ports default to 8082 and 8444; set `HTTP_PORT` and `HTTPS_PORT` in `.env` to change them. Set `HTTPS_DOMAIN` to a DNS name that resolves to the server and `ACME_EMAIL`; normal public certificates require the domain and ports to be reachable by the certificate authority. For a LAN-only deployment, Caddy can issue a private certificate with `tls internal`, but each client device must trust Caddy's root certificate. Enable `DJANGO_SECURE_COOKIES=true` when the app is accessed through HTTPS. Keep it false for the default HTTP LAN deployment. Assign unique values to `APP_PORT`, `HTTP_PORT`, and `HTTPS_PORT` when running multiple production checkouts on the same computer.

The app container uses Nginx to serve the compiled single-page application and proxy API/SSE requests to Django. At API startup, Django runs `collectstatic` into a Compose volume, which Nginx serves under `/static/` for Django admin. The volume contains public static assets only. This is the HTTP application entry point. Caddy is only needed when TLS termination is desired.

To update a production server from Git, keep a clone of this repository on the server, configure its production `.env`, and make sure the deployment account can connect over SSH and run Docker Compose. From a checkout with SSH access to that server, run:

```sh
make deploy DEPLOY_HOST=deploy@server DEPLOY_PATH=/srv/fire-asset-management DEPLOY_BRANCH=main
```

`DEPLOY_HOST` and `DEPLOY_PATH` are required; `DEPLOY_BRANCH` defaults to `main`. The target checks that the server checkout has no uncommitted tracked changes and that its `.env` exists. It then fetches and fast-forwards the selected branch before running `docker compose up --build -d`. The production Compose configuration applies database migrations when the API starts. Keep production secrets and persistent-volume setup on the server; they are not fetched from Git.

## Project customization

Run the template setup script once after creating a repository from this GitHub template:

```sh
python3 scripts/configure_project.py \
  --project-name field-operations \
  --app-title "Field Operations" \
  --python-package field_operations \
  --frontend-port 5174 \
  --app-port 8081
```

The script creates a private, ignored `.env`, renames the Django settings/Celery package, and updates the selected project title and ports. All other configuration lives in `.env`; `.env.example` documents available variables. `PROJECT_NAME` controls the Docker Compose project and `APP_TITLE` controls the browser and app title. `PYTHON_PACKAGE` is the Python package containing Django settings and the Celery app. Set each project's published host ports to distinct values in `.env` when running multiple projects on the same machine. If you change a browser-facing port or host, update `CSRF_TRUSTED_ORIGINS` to match. Keep passwords and Django secret keys out of source control. If database passwords contain URL-reserved characters, use letters and numbers or percent-encode them before placing them in `.env`.

After pushing the code to GitHub, enable **Settings → General → Template repository** in GitHub so users can create repositories from it.

## Commands

| Command | Purpose |
| --- | --- |
| `make dev` | Start the complete development environment with hot reload |
| `make prod` | Start the production HTTP stack |
| `make prod-https` | Add optional Caddy HTTPS; requires DNS and certificate configuration |
| `make deploy DEPLOY_HOST=... DEPLOY_PATH=...` | Fetch the selected Git branch and update production Compose services over SSH |
| `make stop` | Stop services and retain database and Redis data |
| `make logs` | Follow service logs |
| `make test` | Run backend and frontend tests |
| `make lint` | Run Python linting and frontend lint/type checks |
| `make migrate` | Apply Django migrations |
| `make shell` | Open the Django shell |
| `make clean` | Remove containers and persistent volumes after typing `DELETE` |

`make clean` deletes database and Redis data and cannot be undone.

## Dashboard

The staff dashboard opens on a live overview of posts and their current CityGIS vectors. Vectors are grouped into APM, AE, AMB, Rest, and Status 90+; status 99 always appears in Rest, where CMD, MSERV, and FAUB are shown first. Each column shows available/total counts, with status 0 and 6 counted as available. A colored vertical status bar opens that vector's CityGIS status history. APM, AE, AMB, and Status 90+ show two columns of vectors; Rest shows three. Large groups can be expanded in place. The page loads from the existing locations and CityGIS APIs and updates through the existing CityGIS event stream.

Selecting a post opens its shareable **Postdashboard** at `/posts/{id}`. Each vector card shows the vector code above its vehicle code, with a narrow vertical CityGIS status-color line at the left; the resource type and separate current-status label are omitted. The card also shows available vehicle fields and physical pagers and radios placed on the vector. A square-cornered, time-scaled status bar covers the full latest 24 hours, uses CityGIS status colors, marks missing status as unknown, and combines adjacent periods with the same status into one segment. A subtle clock scale below the bar labels four-hour intervals. Status 1 periods longer than three minutes show a small red exclamation marker above the segment. Tooltips include status, duration, and period times; keyboard users can focus each segment. Four category rows appear vertically to the right of the bar: **Beschikbaar** (statuses 0 and 6), **Op interventie** (other numeric statuses below 90), **Buiten dienst** (statuses 90 and above), and **Onbekend**. Each row shows its percentage and duration in hours and minutes; zero-percent rows are hidden. Vectors are grouped in APM, AE, CMD, MSERV, FAUB, and AMB sections; AMBINC is grouped with AMB, and other types appear in a collapsed group when present. The page uses the existing post-overview API and CityGIS event stream.

## Background task flow

1. The browser POSTs to `POST /api/tasks/`; Django responds with Celery's task ID.
2. Celery publishes the task to Redis; workers execute tasks independently of browser connections.
3. `celery-progress` writes progress through Celery's result backend, configured as `django-celery-results` using PostgreSQL.
4. The browser opens `GET /api/tasks/{id}/events/`. Django streams the latest persisted snapshot as SSE, checking PostgreSQL once per second while connected. The browser's native `EventSource` reconnects after network loss; on reconnect the server sends the latest snapshot.
5. `GET /api/tasks/{id}/` retrieves a snapshot; `GET /api/tasks/` lists recent example tasks and Fireplan synchronizations.

Staff can start a pager sync from **Pagers**. It reads Fireplan's QR inventory in batches of up to 500, updates matching pager type, serial number, Fireplan ID, and QR URL, and leaves local-only pagers in place. The sync runs in Celery, so navigation does not stop it. The latest task link is saved in the browser; completion shows a bottom-right toast with an action to open the saved report. The report includes added, updated, unchanged, and failed records. Fireplan model names must match configured pager types exactly. This integration stores the QR URL returned by Fireplan; generating or printing pager labels remains future work.

Staff can also start radio synchronization from **Radio's**. The task uses the same Celery, SSE, persisted progress, and report flow; it reads only the confirmed `Radio mobile Astrid` and `Radio portable Astrid` QR record names. FirePlan ID and QR URL stay read-only, and local radios absent from FirePlan remain in the register.

Task endpoints require an authenticated Django session and CSRF protection. This starter is a single-tenant workspace: authenticated users share the demonstration task list. Add task ownership before using it as a multi-user product. The example supports bounded automatic retries for `RuntimeError` and configured task limits, but it does not expose a cancel button because safe cancellation of running work needs task-specific cooperation.

Celery's database result backend stores status, progress metadata, and results; Redis is the broker and has an append-only volume. Worker shutdown is graceful by default. Late acknowledgements can redeliver a task after abrupt worker loss; this is at-least-once execution and can run work more than once. The demonstration task can safely restart from its beginning. For real work, make tasks idempotent and select retry rules deliberately. Results remain in PostgreSQL until an application-specific cleanup policy is configured; `CELERY_RESULT_EXPIRES` alone does not run cleanup without Celery Beat or another scheduled cleanup mechanism.

## API and operations

- OpenAPI schema: `/api/schema/`
- Swagger UI: `/api/docs/`
- Django admin: `/admin/`
- Development Flower: <http://localhost:5556>

The production Compose file can be deployed with Docker Compose or imported into Portainer as a Compose stack. Set its environment variables and persistent-volume policy before starting it.

Create the first production login interactively with `docker compose exec api python manage.py createsuperuser`. Do not use the development demo account in production.

## Development checks

```sh
make test
make lint
```

GitHub Actions runs the backend checks against PostgreSQL and Redis and runs frontend tests, lint, and TypeScript checks. Docker is not required by the CI workflow itself.

## Pager assets

Open **Pagers** in the app to view and manage pager records. Each pager has a unique serial number and one pager type. The initial types are Swissphone s.QUAD X35 and Swissphone RES.Q XS; the migration adds them automatically. Pager records are stored in the `pager_assets` and `pager_types` PostgreSQL tables.

Under **Pagers**, the **Toestellen** tab manages pager assets and the **RiC-codes** tab contains a standalone register of RiC/AdC pairs and aliases; code records are not linked to individual pager assets. The initial register is populated by a data migration. Duplicate RiC/AdC pairs are rejected. The RiC code is the address pagers listen for in POCSAG broadcasts; the associated AdC code identifies the pager to ASTRID. The app does not send alerts or transmit POCSAG messages. Staff can synchronize pager inventory from FirePlan; the FirePlan ID and complete QR URL are stored with each matching pager. QR label generation and printing are separate future work.

## Radio assets

The **Toestellen** table has a model filter beside the Model column heading. Choose one or more models in its checkbox menu; the filter works together with text search and sorting.

Open **Radio's** directly below **Pagers** and select the **Toestellen** tab to search radios. The other tabs show ISSIs and radio subscriptions. Staff can upload an ASTRID subscription CSV from the Abonnementen tab using the upload icon, file browser, or drag and drop. The import reads `TEI`, the first `BRAND` column, and `IDENTIFIER` (the ISSI), and ignores `SERIAL_NUMBER`; it skips Spare Subscription rows case-insensitively, adds a trailing zero to 14-digit TEIs, accepts 15-digit TEIs unchanged, and rejects other lengths. Missing radios and ISSIs are created. New active links start at upload time, matching existing active links keep their original start, and active links absent from the file end at upload time. The import ignores ASTRID dates and reports processed, skipped, created, and ended records. The subscription table shows its active count and sortable radio, ISSI, type, and start/end columns; each row shows the elapsed duration under its dates. Under **Beheer → Radiobeheer**, staff manage organizations and radio models in two searchable, sortable tabs. TEI ranges are managed from each radio model dialog. Radio models reference a manufacturer through a foreign key; staff select, add, or edit manufacturers in the radio model dialog. Staff can also add, edit, or delete radios and ISSIs, assign subscriptions, set placements, and start FirePlan synchronization. A radio has a unique TEI stored as a digit string. Fourteen-digit FirePlan TEIs gain a trailing 0; 15-digit TEIs remain unchanged; other lengths are rejected. Leading zeros are retained. Optional model references can be assigned from configured TEI ranges; unknown ranges do not prevent registration. ISSIs are independent records and can exist without an active radio subscription. Subscription history shows the start and end of each confirmed association, with at most one current radio per ISSI and one current ISSI per radio. Staff can place a radio directly at a vector, vehicle, or location; each radio has at most one current placement.

Selecting a radio shows its subscription and placement history. Staff choose a vector, vehicle, or location directly as its placement; each radio has at most one current placement, recorded through the existing relationship history. Placing a radio is not a physical-location observation. Scanning uses the existing camera and keyboard scanner. A scan identifies a radio without changing its placement or subscription. FirePlan ID and QR URL are source-managed. The live FirePlan integration currently imports only `Radio mobile Astrid` and `Radio portable Astrid`; an immediate repeated fetch returned the same IDs, but long-term ID stability is not independently confirmed.

## Label printers

Staff users can open **Beheer → Labelprinters** to add, edit, and remove printer configurations, check TCP reachability, and send a text test label. The first supported model is Brother PT-P900W. Each record stores a name, IP address, TCP port (default `9100`), and default tape width (default `12 mm`; supported continuous widths are `6`, `12`, `18`, `24`, and `36 mm`). Printer records are stored in PostgreSQL.

The connection check runs from Django with a two-second timeout and reports only TCP reachability. The test label contains the printer name and current time. It uses the saved model, IP, port, and tape width. A successful response means the Brother driver accepted the print operation; it does not confirm that a physical label came out. Run a proof print with the target PT-P900W and tape before relying on the output. The test-label feature uses `brother-label==2.0a8` and Pillow; see [label-printer dependency notes](docs/label-printer-dependencies.md) for purpose and license status.

Pager QR camera scanning uses `@zxing/browser` to decode camera frames consistently across supported browsers. Camera access requires a secure browser context, usually HTTPS or `localhost`; on an HTTP LAN address, use a keyboard-wedge scanner. See [QR scanner dependency notes](docs/qr-scanner-dependencies.md).

## Fireplan credentials

Staff users can open **Beheer → Fireplan** to save the Fireplan login and password. The app encrypts both the password and any saved Fireplan session cookies in PostgreSQL using `FIREPLAN_CREDENTIAL_KEY`; it never sends the password or cookies back to the browser. Set this key before saving credentials, and keep it stable and backed up: losing or changing it makes stored credentials and sessions unreadable. Generate a key with:

```sh
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The **Fireplan-login testen** button reuses the saved cookie session when Fireplan still accepts it, and logs in again only after that session expires or is rejected. The test follows the documented HTTPS form login and confirms the authenticated profile link. The HTTP client uses Python's standard library; `cryptography` is the added package because Django does not provide reversible encrypted storage for credentials and session cookies.

From **Pagers**, staff can start a Fireplan synchronization. The Celery task reads the QR inventory in pages of up to 500 records and follows Fireplan's total count. It only imports exact names that match a configured pager type, links by serial number on first sync and Fireplan ID on later syncs, and leaves local-only pagers untouched. Staff can navigate while it runs. A bottom-right completion toast links to the saved task report, which lists added, updated, unchanged, and failed rows. Fireplan's QR URL is stored with the pager; the app does not yet generate or print labels.

By default, HTTPS validates both the certificate chain and the hostname. For an internal Fireplan alias whose certificate is issued for another canonical hostname, `FIREPLAN_ALLOW_CERTIFICATE_HOSTNAME_MISMATCH=true` disables only the hostname match; certificate authority validation stays enabled. Use this only for a trusted internal network.

The backend keeps the limited Fireplan inventory extraction map in `backend/fireplan/inventory_mapping.yaml`. It selects `Cabine de conduite` by its exact French name, then selects `Radio portable Astrid` by item type ID `1010`; container UUIDs are resolved from each inventory response. Fireplan timestamps without an offset are interpreted as `Europe/Brussels`. The backend uses PyYAML because Python's standard library does not parse YAML; see [Fireplan inventory dependency notes](docs/fireplan-inventory-dependencies.md).

Staff can open **Beheer → FirePlan-inventarissen** to review paginated FirePlan summaries and their FAM synchronization status, including inventories not yet stored locally. The table shows the stored vector for synchronized inventories and reconstructs it from `VectorVehicleHistory` at the inventory time for unsynchronized rows; missing history is shown as unknown. The list fetches summary data only. Click a successfully synchronized inventory to inspect its locally stored metadata and radio observations. Each observation has a JSON action that opens its raw FirePlan item in a modal. A matched observation links to its FAM radio, showing the ISSI alias and TEI; its radio icon is green when a subscription is active and red when it is inactive. Unmatched source items remain visible without a link. Radio details show the latest linked inventory with its date and available vehicle/vector information; older rows expand on demand and load in server-paginated pages. The latest subscription is shown below radio details with a green active or red inactive indicator; older subscription history is collapsible. Matching uses the FirePlan serial as a TEI: 14 digits gain a trailing zero for comparison, 15 digits stay unchanged, and the original source text is retained. A later successful inventory sync can match an item after its radio is registered; a failed refresh keeps the previous successful snapshot and its links. The inventory sync button reprocesses only that UUID and opens the existing task progress page. Choose an inclusive start and end date to queue a manual reprocessing task for all inventories in that period. Follow progress and review added, updated, skipped, failed, and per-inventory errors on the existing task detail page. FirePlan `updatedAt` has not been confirmed as a reliable signal for edits to closed inventories, so hourly synchronization does not download every inventory's details.

Large date-range inventory syncs use their own Celery limits, defaulting to 30 minutes soft and 31 minutes hard. Completed inventory records are saved as the task processes them, so reaching the limit does not roll back earlier completed records. Set `CELERY_FIREPLAN_INVENTORY_TASK_SOFT_TIME_LIMIT` and `CELERY_FIREPLAN_INVENTORY_TASK_TIME_LIMIT` in `.env` to tune these limits; keep the hard limit above the soft limit.

## CityGIS

Staff can open **Beheer → CityGIS** to view the vehicle fleet, individual operational vectors, and status colors. The page receives changed snapshots over SSE without a browser refresh and provides a manual refresh action. Open **Beheer → Inventaris**, choose Pagers, Vectoren, or RiC/AdC, and search the aligned object list. Column headers sort ascending and descending. Vector rows keep vector, service, post, vehicle, and color-coded status in separate columns; RiC/AdC rows show alias, codes, and linked vector. Selecting a row opens its relationship manager: a pager or RiC/AdC record uses a searchable vector choice whose dropdown opens below the input and outside the modal, while a vector shows available and linked pagers or codes in two searchable columns. Inactive CityGIS vectors are omitted from new selections, while an existing inactive link remains visible for removal. CityGIS and Fireplan values are read-only; pager assignments and code links retain their history. Physical-location observations and inventory-check workflows are not part of this page.

On the inventory Pagers list, **Scannen** accepts one keyboard-wedge scan and opens the matching pager's relationship dialog. Within a vector dialog, scanning links a pager only when it is currently free; assigned pagers are never moved. Camera scanning starts only after pressing **Camera** and requires HTTPS or `localhost` in the browser; keyboard-wedge scanning remains available over the current HTTP LAN setup.

The integration reads active vehicles from Fireplan and vectors from the separate resources service. It reuses the configured Fireplan username/password and encrypted credential storage for the resources-service login. Set `CITYGIS_RESOURCES_BASE_URL` in `.env` to the service origin; the default is `http://resourcesoff.firebru2k8.local`. The worker fetches both sources before saving a snapshot. Rows without a usable vector code are logged and excluded; a vector with a missing status is retained and shown as unknown. The first vector matching a vehicle name is linked; duplicate matches are retained and logged as errors. Missing source records are kept and marked no longer current.

Celery Beat runs `citygis.refresh` every minute. Scheduled runs do not persist task results; manual refreshes use the normal Celery task ID flow. The staff-only `/api/citygis/` snapshot and `/api/citygis/events/` SSE stream expose the last successful data and safe synchronization error state. SSE sends an initial snapshot and checks for database changes once per second. Run this integration only where the configured Fireplan and resources endpoints are reachable; their internal API format is not publicly documented.

Staff can open **Beheer → Locaties** to create and edit posts, buildings, rooms, and other locations in a hierarchy. An optional sort name is available under the form's collapsed **Geavanceerde opties** section. Within each level, locations with a sort name come first and sort alphabetically by that value, then by name; locations without one come last and sort by name. Posts may map to an unassigned CityGIS service; service data stays read-only. The post overview shows current vectors for that service, their operational status, and each vector's current linked Fireplan vehicle. Locations without a service remain usable. Only leaf locations without a mapped service can be deleted. This page does not place physical assets, record physical-location observations, or manage discrepancies.
