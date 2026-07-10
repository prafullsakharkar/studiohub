# Local Development

## Overview

StudioHub provides a fully containerized local development environment using Docker and Docker Compose. The goal is to ensure every developer works with an identical environment, eliminating "works on my machine" issues.

The local environment includes all required services, allowing developers to start the complete platform with a single command.

---

# Objectives

The local development environment provides:

- Consistent Development Environment
- Fast Project Onboarding
- Hot Reloading
- Local Infrastructure
- Debugging Support
- Isolated Dependencies
- Production-like Architecture
- Easy Maintenance

---

# Development Stack

The local environment includes:

```text
React Frontend

Django Backend

PostgreSQL

Redis

Celery Worker

Celery Beat

Nginx
```

---

# Architecture

```text
Developer

↓

Docker Compose

↓

Frontend

↓

Backend

↓

PostgreSQL

↓

Redis

↓

Celery
```

---

# Prerequisites

Required software

| Software | Recommended Version |
|----------|---------------------|
| Git | Latest |
| Docker | Latest Stable |
| Docker Compose | Latest |
| VS Code | Latest |
| Make (Optional) | Latest |

---

# Repository Setup

Clone the repository

```bash
git clone <repository-url>
```

Enter the project

```bash
cd studiohub
```

---

# Environment Configuration

Create local environment configuration.

```text
backend/

.env.development
```

Typical configuration includes:

```text
SECRET_KEY

DATABASE_URL

REDIS_URL

DEBUG

EMAIL_HOST

JWT_SECRET_KEY
```

Do not commit local environment files.

---

# Starting the Application

Build all containers

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml build
```

Start services

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml up
```

Run in background

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml up -d
```

---

# Initial Setup

Execute the following steps after the first startup.

## Apply Migrations

```bash
python manage.py migrate
```

---

## Create Superuser

```bash
python manage.py createsuperuser
```

---

## Collect Static Files

```bash
python manage.py collectstatic
```

---

## Load Seed Data (Optional)

```bash
python manage.py loaddata fixtures/<fixture>.json
```

---

# Access URLs

Default URLs

| Service | URL |
|----------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost/api |
| Django Admin | http://localhost/admin |
| API Documentation | http://localhost/api/docs |

---

# Hot Reload

Development supports automatic reloading.

Frontend

- React Fast Refresh

Backend

- Django Auto Reload

Changes should be reflected immediately without rebuilding containers.

---

# Running Management Commands

Execute commands inside the backend container.

Example

```bash
docker compose exec backend python manage.py migrate
```

Other examples

```bash
docker compose exec backend python manage.py shell

docker compose exec backend python manage.py test

docker compose exec backend python manage.py makemigrations
```

---

# Running Tests

Run all tests

```bash
docker compose exec backend python manage.py test
```

Run a specific app

```bash
docker compose exec backend python manage.py test apps.identity
```

---

# Background Workers

Verify Celery worker

```bash
docker compose logs celery
```

Verify Celery Beat

```bash
docker compose logs celery-beat
```

---

# Database Access

Connect to PostgreSQL

```bash
docker compose exec postgres psql -U postgres
```

Useful commands

```sql
\l

\dt

\d table_name
```

---

# Redis Access

Open Redis CLI

```bash
docker compose exec redis redis-cli
```

Verify connection

```text
PING

PONG
```

---

# Viewing Logs

Backend

```bash
docker compose logs backend
```

Frontend

```bash
docker compose logs frontend
```

All services

```bash
docker compose logs
```

Follow logs

```bash
docker compose logs -f
```

---

# Stopping Services

Stop containers

```bash
docker compose down
```

Stop and remove volumes

```bash
docker compose down -v
```

---

# Updating Dependencies

Backend

```bash
uv sync
```

Frontend

```bash
npm install
```

Rebuild containers after dependency updates.

---

# Recommended VS Code Extensions

Recommended extensions

- Python
- Ruff
- Docker
- ESLint
- Prettier
- GitLens
- PostgreSQL
- REST Client

---

# Troubleshooting

Common issues

## Container Build Failure

```bash
docker compose build --no-cache
```

---

## Migration Issues

```bash
python manage.py migrate
```

---

## Database Reset

```bash
docker compose down -v
```

Restart the application afterwards.

---

## Permission Issues

Verify Docker volume ownership and file permissions.

---

# Best Practices

- Use Docker for all development.
- Keep `.env.development` out of Git.
- Pull latest changes before starting work.
- Run migrations after model changes.
- Keep containers updated.
- Run tests before committing.

---

# Anti-Patterns

Avoid:

- Installing dependencies outside Docker
- Editing production configuration
- Sharing local databases
- Committing `.env` files
- Ignoring failed migrations
- Developing without running tests

---

# Related Documents

- overview.md
- staging.md
- production.md
- ci-cd.md
- release-process.md
- migrations.md
- rollback.md
- ../06-infrastructure/docker.md
- ../08-development/overview.md
- ../08-development/getting-started.md
```