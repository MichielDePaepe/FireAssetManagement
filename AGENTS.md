# Permanent instructions for Codex

## Repository purpose

This is a reusable React + Django web application template. Keep implementation and documentation generic so GitHub template users can configure names, titles, ports, and environment values without code surgery.

## Coding conventions

- Frontend: React function components, TypeScript strict mode, typed API contracts, colocated UI components, and accessible labels/states.
- Backend: Django apps, DRF views/serializers, Celery `shared_task`, explicit validation, and structured logs. Use the existing Celery task ID.
- Keep secrets in environment variables; never commit `.env`, passwords, tokens, or private certificates.
- All visual components must have square corners. Follow the shared shadcn-style components before adding custom primitives.
- Use the existing packages for task execution, progress, result persistence, and monitoring. Do not build another task framework, event bus, or task-result model.

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
