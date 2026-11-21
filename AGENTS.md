# Permanent instructions for Codex

## Repository purpose

This is a reusable React + Django web application template. Keep implementation and documentation generic so GitHub template users can configure names, titles, ports, and environment values without code surgery.

## Coding conventions

- Frontend: React function components, TypeScript strict mode, typed API contracts, colocated UI components, and accessible labels/states.
- Backend: Django apps, DRF views/serializers, Celery `shared_task`, explicit validation, and structured logs. Use the existing Celery task ID.
- Keep secrets in environment variables; never commit `.env`, passwords, tokens, or private certificates.
- All visual components must have square corners. Follow the shared shadcn-style components before adding custom primitives.
- Keep repeated actions compact with square icon-only buttons; provide an accessible `aria-label` and a hover helper through `title`.
- Use the existing packages for task execution, progress, result persistence, and monitoring. Do not build another task framework, event bus, or task-result model.
- Use a consistent table header style across pages: compact title-case labels (never all caps), regular or medium font weight, muted foreground text, a subtle muted background spanning the full table width, consistent cell padding, and one aligned bottom border across the header row. Searchable domain-register tables have sortable data columns; action columns are not sortable. Use fixed table layout and an explicit `colgroup` to keep column geometry stable.
- Follow the **Sortable and filterable tables** interaction pattern below whenever adding sorting or filters to a table.

### Sortable and filterable tables

Use the following interaction for sortable and filterable tables:

- Put sorting controls in the column header. Clicking a column name sorts ascending; clicking it again reverses the direction. Show a neutral sort icon on inactive columns and an up or down icon on the active column. Set `aria-sort` on the active header and give the control an accessible name. Use locale-aware, case-insensitive, numeric-aware comparisons and a stable key as a tie-breaker.
- Put a separate, square filter-icon button beside the header label for filterable columns. Keep its width fixed so it cannot squeeze the label or move other columns. Show the selected-filter count in a small round badge at the button's upper-right corner.
- Open the filter only when its icon is clicked. Render the popup in a portal over the table, without a page-dimming backdrop and without changing table dimensions. Position it against the trigger and keep it inside the viewport. Close on outside click or Escape.
- Use checkboxes for multi-select. Selecting an option applies it and closes the popup; reopening it shows the current selections. Provide a clear action. Combine selected values within one column with OR, and combine different columns' filters with AND.
- Keep table geometry steady while filters change: use a fixed table layout with an explicit `colgroup`, a collapsed border model, fixed-size filter buttons, and one aligned bottom border across the header row. Do not let opening a popup or selecting a filter resize or shift the table.
- Keep sort and filter state independent so users can use both together.
- Preserve accessible state (`aria-expanded`, `aria-label`, and `aria-sort`) and keyboard dismissal. If another page needs the same behavior, reuse or extract the shared implementation instead of introducing a visually different table pattern.

## Technology restrictions

- Keep the approved React/Vite/TypeScript/Tailwind and Django/DRF/Uvicorn/PostgreSQL stack.
- Use Celery, Redis, django-celery-results, celery-progress, Flower, and SSE as documented.
- Do not add Gunicorn or Supervisor.
- Do not replace a chosen technology or change the deployment architecture without explicit user approval.
- Before adding a dependency, explain why an existing package or platform feature cannot do the job and update dependency documentation.

## Testing requirements

- Run backend pytest and frontend Vitest for behavior changes when the required local services are available.
- Cover API validation/authentication, task state and progress, retry/failure paths, SSE behavior, and frontend loading/error/progress states.
- Run Python lint, frontend ESLint, and TypeScript checks after changes.
- Report checks that could not run and the reason; do not present unexecuted checks as passing.

## Documentation requirements

- Evaluate whether `SPEC.md` or `ARCHITECTURE.md` needs changes whenever requirements or architecture-related code changes.
- Keep `ARCHITECTURE.md` factual to the current code, including the single-tenant task list, HTTP default, SSE polling interval, and recovery limits.
- Document any new command or environment variable in README and `.env.example`.

## Architectural change control

- Fundamental changes to authentication, database ownership, queue/result backend, task semantics, SSE transport, or deployment topology require explicit user approval.
- Discuss material alternatives before introducing them. Small integration code is acceptable when it reuses the approved packages and does not create a parallel abstraction.
- Keep cancellation cooperative; never make force-terminating a worker the default cancellation mechanism.
