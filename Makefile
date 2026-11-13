COMPOSE = docker compose
DEV_COMPOSE = $(COMPOSE) --profile monitoring -f compose.yaml -f compose.dev.yaml

.PHONY: dev prod prod-https stop logs test lint migrate shell clean help

help:
	@awk 'BEGIN {FS = ":.*##"}; /^[a-zA-Z_-]+:.*##/ {printf "%-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start the complete development environment with reload enabled
	@test -f .env || cp .env.example .env
	$(DEV_COMPOSE) up --build -d
	@echo "Development app and Flower are available on the ports configured in .env (defaults: 5173 and 5555)."

prod: ## Start the production stack (HTTP by default; optional TLS profile is documented)
	@test -f .env || (echo "Create .env from .env.example and set production secrets first." && exit 1)
	$(COMPOSE) up --build -d
	@echo "Production HTTP app is available on APP_PORT from .env (default: 8080)."

prod-https: ## Add Caddy HTTPS; requires HTTPS_DOMAIN, ACME_EMAIL, and reachable ports 80/443
	@test -f .env || (echo "Create .env and configure HTTPS_DOMAIN and ACME_EMAIL first." && exit 1)
	@python3 -c "from pathlib import Path; v=dict(line.strip().split('=',1) for line in Path('.env').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#')); assert v.get('HTTPS_DOMAIN') and v.get('ACME_EMAIL')" || (echo "Set HTTPS_DOMAIN and ACME_EMAIL in .env first." && exit 1)
	$(COMPOSE) -f compose.yaml -f compose.https.yaml up --build -d

stop: ## Stop containers without removing persistent data
	$(COMPOSE) -f compose.yaml -f compose.dev.yaml down

logs: ## Follow logs from all services
	$(DEV_COMPOSE) logs -f --tail=100

test: ## Run backend and frontend test suites
	$(DEV_COMPOSE) run --rm -e RUN_CELERY_INTEGRATION=true api pytest
	$(DEV_COMPOSE) run --rm frontend npm test -- --run

lint: ## Run Python and TypeScript lint/type checks
	$(DEV_COMPOSE) run --rm api ruff check .
	$(DEV_COMPOSE) run --rm frontend sh -c "npm run lint && npm run typecheck"

migrate: ## Apply Django database migrations
	$(DEV_COMPOSE) exec api python manage.py migrate

shell: ## Open a Django shell
	$(DEV_COMPOSE) exec api python manage.py shell

clean: ## Remove containers and persistent data after explicit confirmation
	@printf "This permanently deletes database and Redis data. Type DELETE to continue: "; \
	read confirm; \
	if [ "$$confirm" != "DELETE" ]; then echo "Cancelled."; exit 1; fi
	$(DEV_COMPOSE) down --volumes --remove-orphans
