# ADR-0015: Caching Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub serves production studios that may contain:

- Thousands of users
- Hundreds of concurrent artists
- Large production schedules
- Millions of assets
- Complex organizational hierarchies
- High-frequency dashboard requests
- Reporting and analytics workloads

Repeatedly querying PostgreSQL for frequently accessed but infrequently changing data increases:

- Response latency
- Database load
- Infrastructure costs
- API response times

The platform requires a centralized caching strategy to improve performance while maintaining data consistency.

---

# Decision

StudioHub adopts a **cache-aside (lazy loading)** strategy using **Redis** as the primary distributed cache.

The application is responsible for:

- Reading from cache
- Loading from the database on cache misses
- Updating or invalidating cached data after modifications

PostgreSQL remains the **single source of truth** for persistent business data.

---

# Objectives

The caching strategy aims to:

- Reduce database load
- Improve API response times
- Increase application scalability
- Minimize duplicate queries
- Support horizontal scaling
- Keep cache invalidation predictable

Caching is a performance optimization, not a persistence mechanism.

---

# Architecture

```text
Client

↓

API

↓

Selector

↓

Redis Cache

↓

(PostgreSQL on Cache Miss)

↓

Cache Result

↓

Return Response
```

Services update the database first and then invalidate or refresh cache entries.

---

# Cache Layers

StudioHub defines multiple cache categories.

### Application Cache

Stores frequently accessed business data.

Examples:

- Organization settings
- Permission definitions
- User preferences
- Feature flags

---

### Query Cache

Stores expensive selector results.

Examples:

- Dashboard summaries
- Analytics
- Organization statistics
- Production metrics

---

### Reference Cache

Stores relatively static lookup data.

Examples:

- Countries
- Time zones
- Languages
- Asset types
- Status definitions

---

### Session Cache

Stores temporary authentication data.

Examples:

- Active sessions
- Trusted devices
- MFA challenges
- Refresh token metadata

---

# Cache Ownership

Selectors are responsible for reading cached data.

Services are responsible for invalidating or refreshing cache after successful writes.

Typical flow:

```text
Read

↓

Selector

↓

Redis

↓

Database (if needed)
```

```text
Write

↓

Service

↓

Database

↓

Commit

↓

Invalidate Cache

↓

Publish Event
```

---

# Cache Keys

Cache keys should follow a consistent naming convention.

Example:

```text
organization:{uuid}

project:{uuid}

task:{uuid}

dashboard:{organization_uuid}

permissions:{role_uuid}
```

Namespacing avoids collisions and simplifies cache management.

---

# Time-To-Live (TTL)

Different cache types may use different expiration policies.

Examples:

| Cache Type | Typical TTL |
|------------|-------------|
| Reference Data | 24 hours |
| Organization Settings | 1 hour |
| Dashboard Metrics | 5 minutes |
| Search Results | 10 minutes |
| Session Data | Session lifetime |

TTL values should balance freshness and performance.

---

# Cache Invalidation

Cache invalidation occurs after successful database commits.

Triggers include:

- Entity creation
- Entity updates
- Soft deletion
- Restoration
- Configuration changes
- Permission changes

Invalidation should target only affected cache entries where possible.

---

# Event Integration

Domain events may trigger cache invalidation.

Examples:

- OrganizationUpdated
- ProjectArchived
- PermissionChanged
- AssetPublished

This keeps caching concerns decoupled from business logic.

---

# Cache Consistency

StudioHub prioritizes **strong consistency for writes** and **eventual consistency for cached reads**.

The database always contains the authoritative state.

Temporary cache staleness is acceptable within configured TTLs.

---

# Performance Guidelines

Suitable candidates for caching include:

- Frequently accessed data
- Expensive aggregation queries
- Dashboard metrics
- Static reference data
- Permission matrices

The following should generally not be cached:

- Highly volatile transactional data
- Large file contents
- Sensitive secrets
- One-time operations

---

# Monitoring

Operational monitoring should include:

- Cache hit ratio
- Cache miss ratio
- Evictions
- Memory usage
- Key expiration
- Latency
- Redis availability

Metrics help validate cache effectiveness.

---

# Security

Cached data should:

- Respect tenant isolation
- Exclude sensitive secrets
- Follow authorization rules
- Use secure Redis deployments
- Avoid storing plaintext credentials

Tenant identifiers should be included in cache keys where applicable.

---

# Alternatives Considered

## No Cache

Advantages:

- Simpler implementation
- Always fresh data

Disadvantages:

- Increased database load
- Higher latency
- Reduced scalability

Rejected.

---

## Write-Through Cache

Advantages:

- Consistent cache state

Disadvantages:

- More complex writes
- Higher write latency
- Additional coupling

Rejected.

---

## Write-Behind Cache

Advantages:

- High write throughput

Disadvantages:

- Risk of data loss
- Eventual persistence
- Increased complexity

Rejected because PostgreSQL is the authoritative data store.

---

# Consequences

## Positive

- Faster API responses
- Reduced database load
- Improved scalability
- Better user experience
- Efficient dashboard performance

## Negative

- Cache invalidation complexity
- Temporary stale reads
- Additional infrastructure
- Memory management requirements

These trade-offs are acceptable for an enterprise platform.

---

# Implementation Guidelines

- Use Redis as the distributed cache.
- Prefer cache-aside for read operations.
- Invalidate cache after successful writes.
- Namespace cache keys consistently.
- Configure TTLs based on data volatility.
- Monitor cache health continuously.
- Never treat Redis as the system of record.

---

# Compliance

Architecture reviews should verify:

- Cache ownership follows the Service/Selector pattern.
- PostgreSQL remains the source of truth.
- Cache invalidation occurs after commits.
- Tenant isolation is maintained in cache entries.
- Sensitive data is not cached unnecessarily.
- Cache performance metrics are monitored.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0006 — PostgreSQL as the Primary Database
- ADR-0007 — Background Processing with Celery & Redis
- ADR-0010 — Multi-Tenant Organization Model

---

# References

- `docs/03-backend/selectors.md`
- `docs/03-backend/services.md`
- `docs/06-infrastructure/redis.md`
- `docs/11-operations/monitoring.md`
- `docs/11-operations/performance.md`