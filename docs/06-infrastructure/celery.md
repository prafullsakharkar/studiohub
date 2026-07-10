# Celery

## Overview

StudioHub uses **Celery** as its distributed task queue for executing asynchronous and scheduled background jobs.

Instead of performing long-running operations during an HTTP request, Celery processes these tasks in the background, improving application responsiveness, scalability, and reliability.

Celery communicates through Redis as the message broker and executes tasks independently from the Django web application.

---

# Objectives

Celery provides:

- Background Processing
- Scheduled Jobs
- Task Retry
- Distributed Workers
- Long Running Tasks
- Notifications
- File Processing
- Workflow Automation

---

# Architecture

```text
                  Django API

                      │

        ┌─────────────┴─────────────┐

        ▼                           ▼

    HTTP Response             Celery Task

                                      │

                                      ▼

                               Redis Broker

                                      │

                                      ▼

                               Celery Worker

                                      │

        ┌──────────────┬──────────────┬──────────────┐

        ▼              ▼              ▼

    Email         Notifications     Reports

```

---

# Responsibilities

Celery is responsible for:

- Sending Emails
- Notifications
- Report Generation
- Scheduled Jobs
- Asset Processing
- Video Processing
- Thumbnail Generation
- AI Processing
- Cleanup Tasks
- Import & Export Jobs

Business logic remains inside the Service Layer.

---

# Components

StudioHub uses the following Celery components.

```text
Celery Application

Celery Worker

Celery Beat

Redis Broker

Task Modules
```

---

# Task Lifecycle

```text
Application

↓

Create Task

↓

Redis Queue

↓

Celery Worker

↓

Execute Task

↓

Update Status

↓

Complete
```

Tasks should never block API responses.

---

# Worker Architecture

```text
Celery Worker

├── Email Queue

├── Notification Queue

├── Report Queue

├── Media Queue

└── Default Queue
```

Different queues allow workloads to be isolated and scaled independently.

---

# Scheduled Tasks

Celery Beat schedules recurring jobs.

Examples

```text
Daily Backups

Cache Cleanup

Expired Token Cleanup

Reminder Emails

Database Maintenance

Activity Summaries
```

Schedules should be defined centrally.

---

# Retry Strategy

Transient failures should be retried automatically.

Examples

- Email Delivery
- External APIs
- File Uploads
- AI Services

Recommended retry policy

```text
Retries

↓

Exponential Backoff

↓

Maximum Retry Count

↓

Failure Notification
```

Permanent failures should be logged and reported.

---

# Task Categories

StudioHub organizes tasks by domain.

```text
Identity

Organization

Production

Notifications

Reports

Media

Maintenance
```

Each module owns its own task definitions.

---

# Example Workflows

## Email Notifications

```text
User Created

↓

UserCreatedEvent

↓

Send Welcome Email

↓

Celery Queue

↓

Email Worker

↓

SMTP Provider
```

---

## Report Generation

```text
User Requests Report

↓

Generate Report Task

↓

Celery Queue

↓

Worker

↓

Create PDF

↓

Notify User
```

---

## Asset Processing

```text
Upload Asset

↓

Create Processing Task

↓

Celery Queue

↓

Worker

↓

Generate Thumbnail

↓

Extract Metadata

↓

Update Database
```

---

# Queue Strategy

Recommended queues

```text
default

emails

notifications

reports

media

exports

imports

maintenance
```

Separate queues improve scalability and fault isolation.

---

# Task Design Principles

Tasks should:

- Be Idempotent
- Be Small
- Be Independent
- Be Retry Safe
- Avoid Database Locks
- Use Transactions Carefully

Long-running tasks should be split into smaller jobs.

---

# Monitoring

Monitor:

- Active Workers
- Queue Length
- Failed Tasks
- Retry Count
- Execution Time
- Memory Usage
- Task Throughput

Recommended monitoring tools

- Flower
- Prometheus
- Grafana

---

# Error Handling

Task failures should:

- Log Detailed Errors
- Retry When Appropriate
- Notify Administrators
- Preserve Failure Context

Unhandled exceptions should never silently fail.

---

# Scaling

Workers can be scaled horizontally.

```text
Redis

↓

Worker 1

Worker 2

Worker 3

Worker 4
```

Queues with heavy workloads can have dedicated worker pools.

---

# Security

Background tasks should:

- Validate Inputs
- Respect Permissions
- Avoid Executing Untrusted Code
- Protect Sensitive Data
- Use Secure Credentials

Tasks should never bypass application security.

---

# Performance

Optimize Celery by:

- Using Multiple Queues
- Limiting Task Size
- Avoiding Large Payloads
- Passing IDs Instead of Objects
- Monitoring Queue Latency

Database objects should be reloaded inside the task instead of serialized into the queue.

---

# Best Practices

- Keep tasks idempotent.
- Keep tasks small.
- Retry transient failures.
- Use dedicated queues.
- Monitor worker health.
- Pass object IDs instead of model instances.
- Log task execution.

---

# Anti-Patterns

Avoid:

- Long-running synchronous tasks
- Large serialized payloads
- Blocking API requests
- Infinite retries
- Business logic inside task definitions
- Sharing mutable state between workers

---

# Testing

Celery testing should verify:

- Task Execution
- Retry Logic
- Queue Routing
- Scheduled Tasks
- Error Handling
- Worker Startup
- Redis Connectivity
- Task Idempotency

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- redis.md
- postgres.md
- monitoring.md
- backup.md
- ../03-backend/events.md
- ../03-backend/services.md
- ../03-backend/tasks.md
```