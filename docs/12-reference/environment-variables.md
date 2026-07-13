# Environment Variables Reference

## Overview

StudioHub uses environment variables to configure application behavior across development, testing, staging, and production environments. Sensitive information and environment-specific settings must never be hardcoded in the source code.

Configuration should follow the **Twelve-Factor App** methodology by storing all deploy-specific settings in environment variables.

---

# Objectives

This reference aims to:

- Standardize configuration
- Simplify deployments
- Improve security
- Support multiple environments
- Reduce configuration drift
- Document available settings
- Simplify onboarding
- Improve operational consistency

---

# Configuration Principles

Environment variables should be:

- Externalized
- Version documented
- Environment-specific
- Secure
- Validated during startup
- Free of sensitive default values

Secrets should be stored in a dedicated secrets management solution whenever possible.

---

# Environment Types

Typical deployment environments:

| Environment | Purpose |
|------------|---------|
| Development | Local development |
| Testing | Automated testing |
| Staging | Pre-production validation |
| Production | Live customer environment |

Each environment may use different values while sharing the same variable names.

---

# Application Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_NAME` | Application name | `StudioHub` |
| `APP_ENV` | Runtime environment | `production` |
| `APP_VERSION` | Current release version | `1.0.0` |
| `DEBUG` | Enable debug mode | `false` |
| `TIME_ZONE` | Default timezone | `UTC` |
| `LANGUAGE_CODE` | Default language | `en-us` |

---

# Django Settings

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `ALLOWED_HOSTS` | Allowed hostnames |
| `CSRF_TRUSTED_ORIGINS` | Trusted CSRF origins |
| `SITE_DOMAIN` | Public domain |
| `DEFAULT_AUTO_FIELD` | Default model primary key type |

`SECRET_KEY` must be unique for every deployment and never committed to version control.

---

# Database Settings

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_HOST` | Database host |
| `DB_PORT` | Database port |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |

Prefer a single `DATABASE_URL` where supported.

---

# Redis Settings

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection URL |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port |
| `REDIS_PASSWORD` | Redis password |

Redis should require authentication in production.

---

# Authentication Settings

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key |
| `JWT_ALGORITHM` | Signing algorithm |
| `JWT_ACCESS_LIFETIME` | Access token lifetime |
| `JWT_REFRESH_LIFETIME` | Refresh token lifetime |
| `MFA_ENABLED` | Enable multi-factor authentication |

Authentication secrets should be rotated periodically.

---

# Email Settings

| Variable | Description |
|----------|-------------|
| `EMAIL_HOST` | SMTP server |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `EMAIL_USE_TLS` | Enable TLS |
| `DEFAULT_FROM_EMAIL` | Sender address |

Production credentials should be stored securely.

---

# Storage Settings

| Variable | Description |
|----------|-------------|
| `MEDIA_ROOT` | Uploaded file location |
| `MEDIA_URL` | Public media URL |
| `STATIC_ROOT` | Static file location |
| `STATIC_URL` | Static URL |
| `STORAGE_BACKEND` | Storage provider |

Cloud storage configuration may require additional provider-specific variables.

---

# Logging Settings

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Default log level |
| `LOG_FORMAT` | Structured or text logging |
| `LOG_RETENTION_DAYS` | Log retention period |

Logging should avoid exposing sensitive information.

---

# Monitoring Settings

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Error reporting endpoint |
| `PROMETHEUS_ENABLED` | Metrics endpoint |
| `OTEL_EXPORTER_ENDPOINT` | OpenTelemetry exporter |
| `HEALTHCHECK_ENABLED` | Health endpoint toggle |

Monitoring configuration should be consistent across environments.

---

# Celery Settings

| Variable | Description |
|----------|-------------|
| `CELERY_BROKER_URL` | Broker connection |
| `CELERY_RESULT_BACKEND` | Result backend |
| `CELERY_TIMEZONE` | Worker timezone |
| `CELERY_CONCURRENCY` | Worker count |

Worker configuration should match workload requirements.

---

# Security Settings

| Variable | Description |
|----------|-------------|
| `SECURE_SSL_REDIRECT` | Force HTTPS |
| `SESSION_COOKIE_SECURE` | Secure session cookies |
| `CSRF_COOKIE_SECURE` | Secure CSRF cookies |
| `HSTS_SECONDS` | HSTS duration |
| `CONTENT_SECURITY_POLICY` | CSP configuration |

Security-related settings should default to secure values in production.

---

# Feature Flags

| Variable | Description |
|----------|-------------|
| `FEATURE_NEW_UI` | Enable new interface |
| `FEATURE_AI_ASSISTANT` | Enable AI features |
| `FEATURE_BETA_MODULES` | Enable beta functionality |

Feature flags support controlled rollouts.

---

# Validation

Application startup should verify:

- Required variables exist
- Values are valid
- Secrets are present
- Numeric values are within acceptable ranges
- URLs are well formed

Fail fast when required configuration is missing.

---

# Security Recommendations

- Never commit `.env` files.
- Store secrets in a secure vault.
- Rotate credentials regularly.
- Restrict access to production secrets.
- Encrypt backups containing configuration.
- Audit environment variable usage.
- Remove unused variables.

---

# Best Practices

- Keep configuration external.
- Use consistent variable names.
- Document every variable.
- Validate configuration at startup.
- Separate secrets from non-sensitive configuration.
- Use secure defaults.
- Review configuration regularly.

---

# Anti-Patterns

Avoid:

- Hardcoded secrets
- Inconsistent variable names
- Missing validation
- Shared production credentials
- Unused configuration
- Committing `.env` files
- Environment-specific code paths

---

# Related Documents

- overview.md
- configuration-reference.md
- coding-standards.md
- ../06-infrastructure/configuration.md
- ../07-deployment/production-deployment.md
- ../10-security/secrets-management.md
- ../11-operations/governance.md