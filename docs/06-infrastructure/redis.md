# Redis

## Overview

StudioHub uses **Redis** as its in-memory data store for caching, background job messaging, rate limiting, distributed locking, and temporary application data.

Redis significantly improves application performance by reducing database load and enabling fast communication between distributed services such as Django and Celery.

Redis is not a primary data store and should never be used for permanent business data.

---

# Objectives

Redis provides:

- High-Speed Cache
- Celery Message Broker
- Result Backend
- Rate Limiting
- Session Storage
- Distributed Locking
- Temporary Data Storage
- Performance Optimization

---

# Architecture

```text
                 Django

                    │

        ┌───────────┼───────────┐
        ▼           ▼           ▼

    Cache      Celery Broker   Sessions

        │           │

        ▼           ▼

             Redis Server
```

Redis acts as a shared infrastructure service across multiple application components.

---

# Responsibilities

Redis is responsible for:

- Application Cache
- Celery Broker
- Celery Result Backend
- Session Storage (Optional)
- Temporary Data
- Distributed Locks
- Rate Limiting
- Queue Management

Redis should never contain critical business data.

---

# Redis Usage

StudioHub uses Redis for:

```text
Cache

Background Jobs

Notifications

OTP Codes

Password Reset Tokens

Rate Limiting

Temporary Upload Data

Feature Flags
```

---

# Cache Architecture

```text
Application

↓

Redis Cache

↓

Cache Hit?

↓

Yes

↓

Return Data

↓

No

↓

PostgreSQL

↓

Store in Cache

↓

Return Response
```

Frequently accessed data should be cached to reduce database queries.

---

# Celery Broker

Redis acts as the message broker.

```text
Application

↓

Redis Queue

↓

Celery Worker

↓

Task Execution
```

This enables asynchronous processing across multiple workers.

---

# Celery Result Backend

Redis may also store:

- Task Status
- Task Progress
- Task Results
- Retry Information

Task results should have expiration times.

---

# Cache Categories

Recommended cache groups

```text
Authentication

Permissions

Organizations

Projects

Shots

Tasks

Dashboard

Settings
```

Each category should use a consistent key namespace.

---

# Cache Key Strategy

Recommended naming convention

```text
studiohub:user:{id}

studiohub:organization:{id}

studiohub:project:{id}

studiohub:permissions:{user_id}

studiohub:dashboard:{organization_id}
```

Consistent naming simplifies cache invalidation.

---

# Cache Expiration

Every cached item should define a TTL (Time-To-Live).

Example

| Data | Suggested TTL |
|--------|---------------|
| User Profile | 15 Minutes |
| Permissions | 30 Minutes |
| Dashboard | 5 Minutes |
| Configuration | 1 Hour |
| Feature Flags | 10 Minutes |

Avoid storing data indefinitely unless required.

---

# Cache Invalidation

Cache should be invalidated when:

- User Updated
- Permissions Changed
- Organization Modified
- Project Updated
- Settings Changed

Application events should trigger cache invalidation automatically.

---

# Distributed Locking

Redis supports distributed locks for operations such as:

- Scheduled Jobs
- Report Generation
- Asset Publishing
- Bulk Imports
- Batch Processing

This prevents duplicate execution across multiple workers.

---

# Rate Limiting

Redis supports API rate limiting.

Example

```text
User

↓

Request Counter

↓

Redis

↓

Limit Exceeded?

↓

Reject Request
```

Rate limiting protects the platform from abuse.

---

# Session Storage

Redis may optionally store:

- User Sessions
- Temporary Authentication Data
- MFA Challenges
- Login Attempts

Persistent business data should remain in PostgreSQL.

---

# Monitoring

Monitor:

- Memory Usage
- Cache Hit Ratio
- Cache Miss Ratio
- Connected Clients
- Queue Length
- Commands Per Second
- Evictions
- Latency

Healthy monitoring ensures predictable application performance.

---

# Persistence

Redis persistence options

- RDB Snapshots
- Append Only File (AOF)

For StudioHub:

- Cache data may be disposable.
- Celery queues may require persistence depending on deployment requirements.

---

# High Availability

Future deployments may use:

```text
Redis Sentinel

↓

Automatic Failover

↓

Replica Promotion
```

Large-scale deployments may also use Redis Cluster.

---

# Security

Redis should:

- Run inside a private network
- Require authentication
- Disable dangerous commands
- Restrict external access
- Use encrypted communication where supported

Redis should never be publicly accessible.

---

# Performance

Optimize Redis by:

- Using expiration times
- Avoiding oversized keys
- Limiting large values
- Monitoring memory usage
- Using efficient data structures

Regular monitoring helps prevent memory exhaustion.

---

# Best Practices

- Cache only frequently accessed data.
- Set expiration for cached items.
- Namespace cache keys.
- Use Redis for temporary data only.
- Monitor memory usage.
- Invalidate cache through application events.
- Secure Redis behind internal networks.

---

# Anti-Patterns

Avoid:

- Storing permanent business data
- Infinite cache lifetimes
- Large serialized objects
- Public Redis access
- Manual cache invalidation
- Using Redis as the primary database

---

# Testing

Redis integration should verify:

- Cache Reads
- Cache Writes
- Cache Expiration
- Cache Invalidation
- Celery Queue Processing
- Rate Limiting
- Distributed Locks
- Connection Recovery

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- postgres.md
- celery.md
- networking.md
- monitoring.md
- backup.md
- ../03-backend/events.md
- ../03-backend/services.md
```