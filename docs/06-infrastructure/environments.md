# Environment Configuration

## Overview

StudioHub supports multiple environments to ensure a reliable software delivery lifecycle. Each environment has its own configuration, infrastructure, database, and deployment process while sharing the same application codebase.

The application behavior is controlled entirely through environment variables, following the **Twelve-Factor App** methodology.

---

# Objectives

Environment management provides:

- Configuration Isolation
- Secure Secret Management
- Independent Deployments
- Environment Consistency
- Production Safety
- Easy Scaling
- CI/CD Integration
- Disaster Recovery

---

# Environment Lifecycle

```text
Development

        │

        ▼

Testing

        │

        ▼

Staging

        │

        ▼

Production
```

Every deployment should follow this promotion path.

---

# Supported Environments

StudioHub currently supports:

```text
Development

Testing

Staging

Production
```

Future environments may include:

```text
Demo

Sandbox

Training

Performance Testing
```

---

# Environment Responsibilities

## Development

Purpose

- Local development
- Feature implementation
- Debugging
- Unit testing

Characteristics

- Debug enabled
- Hot reload
- Local database
- Verbose logging

---

## Testing

Purpose

- Automated testing
- CI pipeline
- Integration testing

Characteristics

- Temporary database
- Fast startup
- Minimal logging
- Isolated execution

---

## Staging

Purpose

- Release validation
- UAT
- Performance verification

Characteristics

- Production-like infrastructure
- HTTPS enabled
- Background workers
- Monitoring enabled

---

## Production

Purpose

- Live application

Characteristics

- Optimized performance
- HTTPS only
- Monitoring
- Backups
- High availability
- Security hardened

---

# Configuration Strategy

Configuration must never be hardcoded.

Use environment variables for:

- Database
- Redis
- Security
- Email
- Storage
- Logging
- Third-party APIs

---

# Directory Structure

```text
backend/

.env.example

.env.development

.env.testing

.env.staging

.env.production
```

Actual `.env` files should never be committed to version control.

---

# Environment Variables

Typical variables include:

```text
DJANGO_ENV

DEBUG

SECRET_KEY

DATABASE_URL

REDIS_URL

ALLOWED_HOSTS

JWT_SECRET_KEY

EMAIL_HOST

EMAIL_PORT

EMAIL_HOST_USER

EMAIL_HOST_PASSWORD

MEDIA_ROOT

STATIC_ROOT

LOG_LEVEL
```

Every variable should have a documented purpose.

---

# Secret Management

Sensitive values include:

- Secret Keys
- JWT Keys
- Database Passwords
- Redis Passwords
- SMTP Credentials
- API Keys
- Cloud Credentials

Secrets should be stored in secure secret management systems in production.

Examples

- Docker Secrets
- Kubernetes Secrets
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

---

# Configuration Loading

Application startup

```text
Environment Variables

↓

Configuration Module

↓

Django Settings

↓

Application Startup
```

Configuration validation should occur during startup.

---

# Environment Validation

Startup should verify:

- Required variables exist
- Invalid values are rejected
- Database connectivity
- Redis connectivity
- Storage availability

Application startup should fail fast when configuration is invalid.

---

# Development Configuration

Recommended settings

```text
DEBUG=True

Auto Reload Enabled

Local PostgreSQL

Local Redis

Console Email Backend
```

Developer convenience is prioritized.

---

# Testing Configuration

Recommended settings

```text
DEBUG=False

Ephemeral Database

Fast Password Hashing

In-Memory Email Backend
```

Tests should be isolated and repeatable.

---

# Staging Configuration

Recommended settings

```text
DEBUG=False

HTTPS Enabled

Production Database

Monitoring Enabled

Background Workers Enabled
```

Staging should closely mirror production.

---

# Production Configuration

Recommended settings

```text
DEBUG=False

HTTPS Only

Secure Cookies

Production Database

Persistent Storage

Monitoring Enabled

Backups Enabled
```

Production must prioritize stability and security.

---

# Feature Flags

Future feature flags may control:

```text
AI Features

Experimental UI

Pipeline Integrations

Beta Modules

Maintenance Mode
```

Feature flags should not require deployments.

---

# Logging Configuration

Each environment should define:

```text
Log Level

Log Destination

Retention Period

Error Reporting
```

Development logs differ significantly from production logs.

---

# Security

Every environment should implement:

- Strong Secrets
- Encrypted Connections
- HTTPS
- Secure Cookies
- Access Control
- Audit Logging

Production environments require the highest security standards.

---

# Backup Configuration

Production environments should automatically back up:

- PostgreSQL
- Uploaded Media
- Configuration
- Generated Reports

Backup schedules should be documented and tested.

---

# Best Practices

- Keep configuration outside the codebase.
- Use environment variables exclusively.
- Validate configuration during startup.
- Keep secrets out of Git.
- Separate environments completely.
- Use identical application code across environments.

---

# Anti-Patterns

Avoid:

- Hardcoded configuration
- Shared databases between environments
- Committing `.env` files
- Production debugging enabled
- Reusing development secrets
- Manual configuration changes

---

# Testing

Environment testing should verify:

- Variable loading
- Configuration validation
- Database connections
- Redis connections
- Secret availability
- Startup validation
- Environment isolation

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- nginx.md
- postgres.md
- redis.md
- celery.md
- storage.md
- networking.md
- logging.md
- monitoring.md
- backup.md
- ../07-deployment/overview.md
```