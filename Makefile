# ==============================================================================
# Variables
# ==============================================================================

PROJECT_NAME := vfx-platform

COMPOSE := docker compose \
	-f infrastructure/compose/compose.yml \
	-f infrastructure/compose/compose.dev.yml

COMPOSE_PROD := docker compose \
	-f infrastructure/compose/compose.yml \
	-f infrastructure/compose/compose.prod.yml

DJANGO := $(COMPOSE) exec django
PYTHON := $(DJANGO) python
MANAGE := $(PYTHON) manage.py

.DEFAULT_GOAL := help

# ==============================================================================
# Help
# ==============================================================================

.PHONY: help

help:
	@echo ""
	@echo "==================== $(PROJECT_NAME) ===================="
	@echo ""
	@echo "Docker"
	@echo "  make build              Build containers"
	@echo "  make up                 Start containers"
	@echo "  make down               Stop containers"
	@echo "  make restart            Restart containers"
	@echo "  make logs               Show logs"
	@echo "  make ps                 List containers"
	@echo "  make shell              Django shell"
	@echo ""
	@echo "Database"
	@echo "  make makemigrations"
	@echo "  make migrate"
	@echo "  make dbshell"
	@echo "  make createsuperuser"
	@echo ""
	@echo "Testing"
	@echo "  make test"
	@echo "  make pytest"
	@echo "  make coverage"
	@echo ""
	@echo "Quality"
	@echo "  make lint"
	@echo "  make format"
	@echo "  make typecheck"
	@echo "  make check"
	@echo ""
	@echo "Django"
	@echo "  make collectstatic"
	@echo "  make shellplus"
	@echo ""

# ==============================================================================
# Docker
# ==============================================================================

.PHONY: build
build:
	$(COMPOSE) build

.PHONY: up
up:
	$(COMPOSE) up -d

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: restart
restart:
	$(COMPOSE) down
	$(COMPOSE) up -d

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: ps
ps:
	$(COMPOSE) ps

.PHONY: shell
shell:
	$(COMPOSE) exec django bash

# ==============================================================================
# Django
# ==============================================================================

.PHONY: migrate
migrate:
	$(MANAGE) migrate

.PHONY: makemigrations
makemigrations:
	$(MANAGE) makemigrations

.PHONY: createsuperuser
createsuperuser:
	$(MANAGE) createsuperuser

.PHONY: collectstatic
collectstatic:
	$(MANAGE) collectstatic --noinput

.PHONY: shellplus
shellplus:
	$(MANAGE) shell_plus

# ==============================================================================
# Database
# ==============================================================================

.PHONY: dbshell
dbshell:
	$(MANAGE) dbshell

# ==============================================================================
# Tests
# ==============================================================================

.PHONY: test
test:
	$(COMPOSE) exec django pytest

.PHONY: pytest
pytest:
	$(COMPOSE) exec django pytest -vv

.PHONY: coverage
coverage:
	$(COMPOSE) exec django pytest \
		--cov=. \
		--cov-report=term \
		--cov-report=html

# ==============================================================================
# Lint
# ==============================================================================

.PHONY: lint
lint:
	$(COMPOSE) exec django ruff check .

.PHONY: format
format:
	$(COMPOSE) exec django ruff format .

.PHONY: typecheck
typecheck:
	$(COMPOSE) exec django basedpyright

.PHONY: check
check:
	$(COMPOSE) exec django \
		sh -c "ruff check . && basedpyright"

# ==============================================================================
# Production
# ==============================================================================

.PHONY: prod-build
prod-build:
	$(COMPOSE_PROD) build

.PHONY: prod-up
prod-up:
	$(COMPOSE_PROD) up -d

.PHONY: prod-down
prod-down:
	$(COMPOSE_PROD) down

# ==============================================================================
# Cleanup
# ==============================================================================

.PHONY: clean
clean:
	docker system prune -f

.PHONY: clean-all
clean-all:
	docker system prune -af
	docker volume prune -f

.PHONY: reset-db
reset-db:
	$(COMPOSE) down -v
	$(COMPOSE) up -d postgres
