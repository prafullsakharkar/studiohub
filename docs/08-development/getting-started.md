# Getting Started

## Overview

This guide helps new developers quickly set up the StudioHub development environment and understand the project structure, development workflow, and engineering standards.

By following this guide, a new developer should be able to clone the repository, start the application, understand the architecture, and begin contributing within a short period of time.

---

# Objectives

This guide helps developers:

- Setup Development Environment
- Understand Project Architecture
- Configure Local Services
- Run the Application
- Execute Tests
- Follow Development Standards
- Create First Contribution

---

# Prerequisites

Before starting, install the following software.

| Software | Recommended Version |
|------------|--------------------|
| Git | Latest Stable |
| Docker | Latest Stable |
| Docker Compose | Latest |
| Python | 3.14 |
| Node.js | Latest LTS |
| npm | Latest |
| VS Code | Latest |

---

# Clone Repository

Clone the project.

```bash
git clone <repository-url>
```

Navigate into the project.

```bash
cd studiohub
```

---

# Project Structure

The repository is organized into multiple top-level directories.

```text
studiohub/

backend/

frontend/

infrastructure/

docs/

scripts/

.github/
```

Each directory has a dedicated responsibility.

---

# Environment Configuration

Create the development environment file.

```text
backend/

.env.development
```

Typical variables include:

```text
SECRET_KEY

DEBUG

DATABASE_URL

REDIS_URL

JWT_SECRET_KEY

EMAIL_HOST
```

Never commit environment files.

---

# Start Infrastructure

Build Docker images.

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml build
```

Start all services.

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml up
```

Run in background.

```bash
docker compose -f infrastructure/compose/docker-compose.dev.yml up -d
```

---

# Initialize Database

Run migrations.

```bash
docker compose exec backend python manage.py migrate
```

Create a superuser.

```bash
docker compose exec backend python manage.py createsuperuser
```

Collect static files.

```bash
docker compose exec backend python manage.py collectstatic
```

---

# Verify Installation

Open the following URLs.

| Service | URL |
|----------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost/api |
| Django Admin | http://localhost/admin |
| API Documentation | http://localhost/api/docs |

---

# Development Workflow

Typical workflow.

```text
Create Branch

↓

Develop Feature

↓

Run Tests

↓

Commit Changes

↓

Push Branch

↓

Create Pull Request

↓

Code Review

↓

Merge
```

---

# Running Tests

Run all tests.

```bash
docker compose exec backend python manage.py test
```

Run a specific application.

```bash
docker compose exec backend python manage.py test apps.identity
```

---

# Running Code Quality Tools

Backend formatting.

```bash
ruff check .

ruff format .
```

Frontend linting.

```bash
npm run lint
```

TypeScript checking.

```bash
npm run type-check
```

Developers should run these checks before every commit.

---

# Viewing Logs

Backend logs.

```bash
docker compose logs backend
```

Celery logs.

```bash
docker compose logs celery
```

All services.

```bash
docker compose logs
```

---

# Project Architecture

StudioHub follows a layered architecture.

```text
React UI

↓

REST API

↓

Service Layer

↓

Selector Layer

↓

Managers

↓

Models

↓

PostgreSQL
```

Business logic belongs in the Service Layer.

---

# Development Standards

Every contribution should follow:

- PEP 8
- Ruff Formatting
- Type Hinting
- Layered Architecture
- Small Functions
- Comprehensive Tests
- Clear Documentation

---

# Recommended VS Code Extensions

Recommended extensions.

- Python
- Docker
- Ruff
- GitLens
- ESLint
- Prettier
- PostgreSQL
- REST Client
- Material Icon Theme

---

# Before Creating Your First Pull Request

Verify:

- Application Builds
- Tests Pass
- Ruff Passes
- Documentation Updated
- No Debug Code
- No Secrets Committed
- Commit Messages Follow Standards

---

# Common Issues

Typical issues include:

- Docker not running
- Missing environment variables
- Database migrations pending
- Redis unavailable
- Incorrect Python version
- Node dependency mismatch

Most issues can be resolved by rebuilding the containers and verifying the environment configuration.

---

# Learning Path

New developers should read the documentation in the following order.

```text
01 Introduction

↓

02 Architecture

↓

03 Backend

↓

04 Frontend

↓

05 Database

↓

06 Infrastructure

↓

07 Deployment

↓

08 Development

↓

09 Testing

↓

10 Security
```

---

# Best Practices

- Pull the latest changes before starting work.
- Create a feature branch for every task.
- Write tests alongside code.
- Keep commits focused.
- Update documentation when functionality changes.
- Ask for reviews early.
- Follow the established architecture.

---

# Related Documents

- overview.md
- project-structure.md
- coding-standards.md
- django-guidelines.md
- react-guidelines.md
- git-workflow.md
- testing.md
- contributing.md
- ../02-architecture/overview.md
- ../07-deployment/local-development.md
```