# Logging

## Overview

StudioHub implements centralized, structured logging across all infrastructure and application components to improve observability, debugging, auditing, and operational monitoring.

Logging is designed to provide complete visibility into system behavior while ensuring sensitive information is never exposed.

Each infrastructure service generates its own logs, which can later be aggregated into a centralized logging platform.

---

# Objectives

The logging system provides:

- Application Monitoring
- Error Tracking
- Audit Trails
- Performance Analysis
- Security Investigation
- Infrastructure Monitoring
- Operational Visibility
- Troubleshooting

---

# Logging Architecture

```text
                  StudioHub

                       │

      ┌────────────────┼────────────────┐

      ▼                ▼                ▼

  Django Logs     Nginx Logs      Celery Logs

      │                │                │

      └────────────────┼────────────────┘

                       ▼

              Log Aggregation

                       ▼

            Monitoring Dashboard
```

Future deployments may integrate with centralized logging platforms.

---

# Log Sources

StudioHub generates logs from:

```text
Application

REST API

Authentication

Background Workers

Nginx

PostgreSQL

Redis

Docker

Operating System
```

Each component should produce structured logs.

---

# Log Categories

Recommended categories

```text
Application

Access

Authentication

Audit

Security

Infrastructure

Performance

Background Tasks
```

Each category serves a different operational purpose.

---

# Log Levels

StudioHub follows standard logging levels.

| Level | Purpose |
|---------|----------|
| DEBUG | Development Information |
| INFO | Normal Operations |
| WARNING | Unexpected Conditions |
| ERROR | Recoverable Failures |
| CRITICAL | System Failure |

Production environments should avoid DEBUG logging.

---

# Structured Logging

Logs should use structured formats such as JSON.

Example

```json
{
  "timestamp": "2026-07-10T10:30:15Z",
  "level": "INFO",
  "service": "backend",
  "module": "identity",
  "message": "User authenticated successfully",
  "request_id": "c8e44d51"
}
```

Structured logs improve searching and analysis.

---

# Request Logging

Every HTTP request should capture:

- Timestamp
- HTTP Method
- Request Path
- Response Status
- Response Time
- User ID (when authenticated)
- Request ID
- Client IP

Sensitive request data should never be logged.

---

# Authentication Logging

Authentication events include:

```text
Login

Logout

Failed Login

Password Reset

Token Refresh

MFA Verification

Account Lockout
```

These logs support security investigations.

---

# Audit Logging

Business events should record:

- User
- Action
- Entity
- Timestamp
- Previous Values
- New Values

Audit logs should remain immutable.

---

# Background Task Logging

Celery workers should log:

- Task Start
- Task Completion
- Task Duration
- Retry Attempts
- Failures
- Queue Name

Long-running tasks should include progress updates.

---

# Infrastructure Logging

Infrastructure logs include:

```text
Nginx

Docker

PostgreSQL

Redis

Operating System
```

Infrastructure logs help diagnose deployment and networking issues.

---

# Error Logging

Errors should include:

- Error Message
- Stack Trace
- Request ID
- User ID (if available)
- Context Information

Sensitive information must be excluded.

---

# Performance Logging

Track:

- Slow Requests
- Database Query Time
- API Latency
- Background Task Duration
- Cache Performance

Performance logs support optimization efforts.

---

# Log Retention

Recommended retention

| Log Type | Retention |
|----------|-----------|
| Application | 90 Days |
| Audit | Business Policy |
| Security | 1 Year |
| Infrastructure | 90 Days |
| Debug | Development Only |

Retention policies should comply with organizational requirements.

---

# Log Rotation

Logs should be rotated automatically based on:

- File Size
- Age
- Storage Capacity

Old logs should be archived or deleted according to retention policies.

---

# Centralized Logging

Future supported platforms

- ELK Stack
- OpenSearch
- Grafana Loki
- Splunk
- Datadog

Centralized logging simplifies operational monitoring.

---

# Security

Logs must never contain:

- Passwords
- JWT Tokens
- API Keys
- Secret Keys
- Credit Card Data
- Personally Sensitive Information

Sensitive values should always be masked.

---

# Monitoring Integration

Logs should integrate with:

- Prometheus
- Grafana
- Sentry
- OpenTelemetry

Critical errors should trigger alerts automatically.

---

# Best Practices

- Use structured logging.
- Include request identifiers.
- Log business events.
- Separate audit logs.
- Rotate logs automatically.
- Secure sensitive information.
- Monitor error rates.

---

# Anti-Patterns

Avoid:

- Logging passwords
- Logging JWT tokens
- Excessive DEBUG logs in production
- Duplicate log entries
- Missing timestamps
- Inconsistent log formats

---

# Testing

Logging should verify:

- Log Generation
- Log Levels
- Structured Output
- Error Logging
- Audit Events
- Request Correlation
- Log Rotation
- Sensitive Data Masking

---

# Related Documents

- overview.md
- monitoring.md
- backup.md
- networking.md
- environments.md
- ../03-backend/events.md
- ../03-backend/services.md
- ../10-security/audit.md
- ../10-security/overview.md
```