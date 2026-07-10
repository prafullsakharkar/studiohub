# Docker Compose

## Overview

StudioHub uses Docker Compose to orchestrate all infrastructure services required for local development, testing, staging, and production.

Docker Compose defines how containers are built, networked, configured, and started, allowing developers to launch the complete platform with a single command.

Each environment maintains its own Compose configuration while sharing common service definitions.

---

# Objectives

Docker Compose provides:

- Multi-Container Orchestration
- Environment Isolation
- Service Networking
- Volume Management
- Environment Configuration
- Dependency Management
- Local Development
- Production Deployment Foundation

---

# Architecture

```text
docker-compose.yml

        │

        ▼

────────────────────────────────────

Frontend

Backend

PostgreSQL

Redis

Celery Worker

Celery Beat

Nginx

────────────────────────────────────

        │

        ▼

Docker Network
```

---

# Directory Structure

```text
infrastructure/

compose/
│
├── docker-compose.dev.yml
├── docker-compose.test.yml
├── docker-compose.stage.yml
├── docker-compose.prod.yml
├── docker-compose.override.yml
└── README.md
```

Each environment should maintain its own Compose configuration.

---

# Service Overview

StudioHub consists of the following services.

```text
frontend

backend

postgres

redis

celery

celery-beat

nginx
```

Each service has a single responsibility.

---

# Service Dependencies

```text
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

Compose automatically starts dependencies before dependent services.

---

# Startup Sequence

```text
Docker Network

↓

PostgreSQL

↓

Redis

↓

Backend

↓

Celery Worker

↓

Celery Beat

↓

Frontend

↓

Nginx
```

Health checks should determine service readiness instead of startup order alone.

---

# Development Environment

Development Compose should include:

- Source Code Mounting
- Hot Reload
- Debug Mode
- Development Database
- Local Redis
- Developer Tools

Optimized for rapid iteration.

---

# Testing Environment

Testing Compose should provide:

- Isolated Database
- Temporary Storage
- Test Redis
- Minimal Logging
- Fast Startup

No persistent development data should be reused.

---

# Staging Environment

Staging should closely mirror production.

Includes:

- Production Configuration
- HTTPS
- Background Workers
- Scheduled Tasks
- Persistent Storage

Used for release validation.

---

# Production Environment

Production Compose should include:

- Optimized Images
- Read-only Containers (where possible)
- SSL
- Reverse Proxy
- Monitoring
- Log Aggregation
- Automatic Restart
- Resource Limits

Production should never mount source code.

---

# Networks

StudioHub uses internal Docker networks.

Example

```text
frontend-network

backend-network

database-network
```

Only Nginx exposes ports to external clients.

---

# Volumes

Persistent volumes should be created for:

```text
postgres_data

media

static

redis_data

logs
```

Containers should remain stateless.

---

# Environment Variables

Configuration is supplied through environment files.

Examples

```text
.env

.env.development

.env.testing

.env.staging

.env.production
```

Each environment should maintain independent configuration.

---

# Health Checks

Every critical service should expose a health check.

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

Compose should wait for healthy services whenever possible.

---

# Restart Policies

Recommended restart policy

```text
unless-stopped
```

Critical production services should automatically recover after failures.

---

# Resource Limits

Compose should define:

- CPU Limits
- Memory Limits
- Swap Limits
- File Descriptor Limits

This prevents resource contention.

---

# Logging

Container logs should be written to:

```text
stdout

stderr
```

Production environments should forward logs to centralized logging systems.

---

# Security

Compose files should:

- Use non-root containers
- Avoid privileged mode
- Limit exposed ports
- Store secrets outside Git
- Use internal networks
- Restrict container capabilities

---

# Scaling

Docker Compose supports scaling stateless services.

Examples

```text
Backend

↓

Multiple Containers
```

```text
Celery

↓

Multiple Workers
```

Databases should generally not be scaled using Docker Compose.

---

# Common Commands

Start services

```bash
docker compose -f docker-compose.dev.yml up
```

Start in background

```bash
docker compose -f docker-compose.dev.yml up -d
```

Stop services

```bash
docker compose down
```

Rebuild containers

```bash
docker compose build
```

View logs

```bash
docker compose logs -f
```

Restart a service

```bash
docker compose restart backend
```

---

# Best Practices

- Keep Compose files environment-specific.
- Use environment variables.
- Use health checks.
- Define restart policies.
- Keep services isolated.
- Persist only required data.
- Version Compose files with the project.

---

# Anti-Patterns

Avoid:

- Hardcoded secrets
- Mounting production source code
- Exposing database ports publicly
- Running multiple applications in one container
- Sharing development volumes with production
- Ignoring health checks

---

# Testing

Docker Compose testing should verify:

- Service startup
- Health checks
- Network connectivity
- Volume persistence
- Environment configuration
- Dependency resolution
- Background workers
- Graceful shutdown

---

# Related Documents

- overview.md
- docker.md
- nginx.md
- postgres.md
- redis.md
- celery.md
- environments.md
- networking.md
- storage.md
- deployment.md