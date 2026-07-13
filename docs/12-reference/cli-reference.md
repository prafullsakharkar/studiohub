# CLI Reference

## Overview

This document provides a centralized reference for commonly used command-line operations in StudioHub. It includes development, database, testing, Docker, Celery, frontend, deployment, and operational commands.

The examples assume the project's recommended technology stack:

- Python 3.14+
- Django 6
- React 19
- Vite
- PostgreSQL 18
- Redis
- Celery
- Docker Compose
- UV Package Manager

Commands may vary depending on the deployment environment.

---

# Development Environment

## Install Python Dependencies

```bash
uv sync
```

---

## Update Dependencies

```bash
uv lock --upgrade
```

---

## Install Frontend Dependencies

```bash
npm install
```

---

## Start Development Server

Backend:

```bash
python manage.py runserver
```

Frontend:

```bash
npm run dev
```

---

# Database Commands

## Create Migrations

```bash
python manage.py makemigrations
```

---

## Apply Migrations

```bash
python manage.py migrate
```

---

## Show Migration Status

```bash
python manage.py showmigrations
```

---

## Open Django Shell

```bash
python manage.py shell
```

---

## Create Superuser

```bash
python manage.py createsuperuser
```

---

## Flush Database

```bash
python manage.py flush
```

**Warning:** This permanently removes all data.

---

# Static Files

Collect static files:

```bash
python manage.py collectstatic
```

---

# Testing

Run all tests:

```bash
pytest
```

---

Run a specific file:

```bash
pytest tests/test_users.py
```

---

Run with coverage:

```bash
pytest --cov
```

---

# Code Quality

Format Python:

```bash
black .
```

---

Lint Python:

```bash
ruff check .
```

---

Auto-fix lint issues:

```bash
ruff check . --fix
```

---

Type checking:

```bash
mypy .
```

---

# Frontend Commands

Run development server:

```bash
npm run dev
```

---

Build production bundle:

```bash
npm run build
```

---

Run tests:

```bash
npm test
```

---

Lint frontend:

```bash
npm run lint
```

---

Preview production build:

```bash
npm run preview
```

---

# Docker

Build containers:

```bash
docker compose build
```

---

Start services:

```bash
docker compose up
```

---

Start in detached mode:

```bash
docker compose up -d
```

---

Stop services:

```bash
docker compose down
```

---

View logs:

```bash
docker compose logs
```

---

Restart services:

```bash
docker compose restart
```

---

Open shell inside backend:

```bash
docker compose exec backend bash
```

---

# PostgreSQL

Open PostgreSQL shell:

```bash
psql DATABASE_NAME
```

---

Backup database:

```bash
pg_dump DATABASE_NAME > backup.sql
```

---

Restore database:

```bash
psql DATABASE_NAME < backup.sql
```

---

# Redis

Open Redis CLI:

```bash
redis-cli
```

---

Check Redis:

```bash
redis-cli ping
```

---

# Celery

Start worker:

```bash
celery -A config worker -l info
```

---

Start beat scheduler:

```bash
celery -A config beat -l info
```

---

Inspect active workers:

```bash
celery -A config inspect active
```

---

# Git

Clone repository:

```bash
git clone <repository>
```

---

Create feature branch:

```bash
git checkout -b feature/example
```

---

View status:

```bash
git status
```

---

Commit changes:

```bash
git commit -m "feat(module): description"
```

---

Push changes:

```bash
git push origin feature/example
```

---

# Production

Run application checks:

```bash
python manage.py check
```

---

Verify deployment:

```bash
python manage.py check --deploy
```

---

Collect static assets:

```bash
python manage.py collectstatic --noinput
```

---

# Monitoring

View logs:

```bash
docker compose logs -f
```

---

Check running containers:

```bash
docker ps
```

---

View resource usage:

```bash
docker stats
```

---

# Security

Generate Django secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

Rotate secrets:

Refer to the organization's secrets management procedure.

---

# Troubleshooting

Restart all containers:

```bash
docker compose down

docker compose up -d
```

---

Rebuild images:

```bash
docker compose build --no-cache
```

---

Clear Python cache:

```bash
find . -name "__pycache__" -type d -exec rm -rf {} +
```

---

Clear frontend cache:

```bash
rm -rf node_modules

rm package-lock.json

npm install
```

---

# Best Practices

- Prefer automated scripts over manual commands.
- Review commands before executing in production.
- Use virtual environments during local development.
- Back up databases before destructive operations.
- Keep dependencies up to date.
- Use consistent Git workflows.
- Document new operational commands.

---

# Anti-Patterns

Avoid:

- Running destructive commands in production without backups
- Skipping database migrations
- Using outdated dependencies
- Executing commands as root unnecessarily
- Bypassing automated deployment pipelines
- Modifying production containers manually
- Ignoring command output and warnings

---

# Related Documents

- overview.md
- configuration-reference.md
- environment-variables.md
- ../07-deployment/production-deployment.md
- ../08-development/local-development.md
- ../11-operations/runbooks.md
- ../10-security/secrets-management.md