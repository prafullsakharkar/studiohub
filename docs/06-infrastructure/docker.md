# Docker

## Overview

StudioHub is fully containerized using Docker, providing a consistent and reproducible environment for development, testing, staging, and production.

Each major service runs inside its own container, allowing independent scaling, simplified deployments, and isolated dependencies.

Docker is the foundation of the StudioHub infrastructure.

---

# Objectives

Docker provides:

- Reproducible Development
- Environment Isolation
- Dependency Management
- Simplified Deployment
- Service Isolation
- Version Consistency
- Faster Onboarding
- Production Parity

---

# Container Architecture

```text
                    Docker Network

        ┌──────────────────────────────────────┐
        │                                      │
        │     nginx                            │
        │        │                             │
        │        ▼                             │
        │   backend (Django)                   │
        │      │      │                        │
        │      │      ├──────── Redis          │
        │      │                              │
        │      ├──────── PostgreSQL           │
        │      │                              │
        │      └──────── Celery Workers       │
        │                                     │
        │   frontend (React)                  │
        │                                     │
        └──────────────────────────────────────┘
```

---

# Container Responsibilities

## Frontend

Responsibilities

- React Application
- Static Assets
- API Integration
- Client Routing

---

## Backend

Responsibilities

- Django
- REST API
- Authentication
- Business Logic
- File Uploads

---

## PostgreSQL

Responsibilities

- Persistent Database
- Transactions
- Constraints
- Indexes

---

## Redis

Responsibilities

- Cache
- Celery Broker
- Temporary Storage
- Rate Limiting

---

## Celery Worker

Responsibilities

- Background Jobs
- Email
- Notifications
- Report Generation
- Asset Processing

---

## Celery Beat

Responsibilities

- Scheduled Tasks
- Cleanup Jobs
- Periodic Notifications
- Maintenance Tasks

---

## Nginx

Responsibilities

- Reverse Proxy
- SSL Termination
- Static Files
- Media Files
- Load Balancing

---

# Development Workflow

```text
Git Clone

↓

Docker Build

↓

Docker Compose Up

↓

Containers Running

↓

Application Ready
```

No manual dependency installation should be required.

---

# Docker Images

Each service should maintain its own Docker image.

```text
frontend

backend

postgres

redis

nginx

celery
```

Each image has a dedicated Dockerfile.

---

# Build Process

```text
Source Code

↓

Docker Build

↓

Docker Image

↓

Docker Container

↓

Running Service
```

Images should be immutable after creation.

---

# Multi-Stage Builds

Production images should use multi-stage builds.

Benefits

- Smaller Images
- Faster Deployments
- Reduced Attack Surface
- Better Caching

Typical stages

```text
Dependencies

↓

Build

↓

Runtime
```

---

# Docker Volumes

Persistent volumes should be used for:

```text
PostgreSQL Data

Media Files

Static Files

Redis Data (optional)

Logs
```

Application code should not be stored in persistent volumes in production.

---

# Networks

StudioHub uses an isolated Docker network.

```text
Frontend

↓

Backend

↓

Database

↓

Redis

↓

Workers
```

External access is restricted to Nginx.

---

# Environment Variables

Container configuration should be supplied through environment variables.

Examples

```text
DATABASE_URL

REDIS_URL

SECRET_KEY

JWT_SECRET

EMAIL_HOST

DEBUG

ALLOWED_HOSTS
```

Sensitive values should never be committed to Git.

---

# Health Checks

Every container should expose a health check.

Examples

Backend

```text
GET /health/
```

PostgreSQL

```text
pg_isready
```

Redis

```text
redis-cli ping
```

Health checks enable automated recovery and orchestration.

---

# Restart Policy

Recommended restart policy

```text
unless-stopped
```

Production orchestrators may use more advanced restart strategies.

---

# Resource Limits

Containers should define:

- CPU Limits
- Memory Limits
- Disk Limits
- Open File Limits

This prevents one service from exhausting host resources.

---

# Logging

Containers should write logs to stdout/stderr.

Benefits

- Docker log collection
- Kubernetes compatibility
- Centralized logging
- Easier debugging

Avoid writing logs directly to local files.

---

# Security

Docker containers should:

- Run as non-root users
- Use minimal base images
- Avoid unnecessary packages
- Keep images updated
- Scan for vulnerabilities
- Use read-only filesystems where possible

---

# Performance

Optimize Docker by:

- Layer caching
- Multi-stage builds
- Small base images
- Efficient dependency installation
- Ignoring unnecessary files with `.dockerignore`

---

# Best Practices

- One service per container.
- Keep images lightweight.
- Use environment variables.
- Use health checks.
- Keep containers stateless.
- Pin dependency versions.
- Use multi-stage builds.

---

# Anti-Patterns

Avoid:

- Running multiple applications in one container
- Hardcoded secrets
- Root containers
- Large base images
- Manual container configuration
- Mutable production containers

---

# Testing

Docker infrastructure should verify:

- Image builds
- Container startup
- Health checks
- Network connectivity
- Volume mounting
- Environment configuration
- Service communication

---

# Related Documents

- overview.md
- docker-compose.md
- nginx.md
- postgres.md
- redis.md
- celery.md
- environments.md
- storage.md
- networking.md
```