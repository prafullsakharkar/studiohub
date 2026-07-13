# ADR-0006: PostgreSQL as the Primary Database

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub manages large volumes of structured production data across multiple business domains, including:

- Identity
- Organization
- Production
- Assets
- Pipeline
- Reviews
- Reporting
- Notifications

The platform requires a relational database that provides:

- ACID transactions
- Strong referential integrity
- Advanced indexing
- JSON document support
- Full-text search
- High reliability
- Mature tooling
- Horizontal read scaling
- Enterprise features

The database must support both current development needs and long-term enterprise growth.

---

# Decision

StudioHub adopts **PostgreSQL** as its primary operational database for all persistent application data.

All domain models managed through Django ORM will be stored in PostgreSQL.

The project standardizes on **PostgreSQL 18** for new deployments, with version upgrades managed through the normal release process.

---

# Database Responsibilities

PostgreSQL stores:

- Users
- Organizations
- Departments
- Teams
- Projects
- Episodes
- Sequences
- Shots
- Tasks
- Assets
- Reviews
- Audit logs
- Configuration
- Metadata

It is the system of record for all transactional business data.

---

# Why PostgreSQL

PostgreSQL was selected because it provides:

- Excellent SQL compliance
- Mature query optimizer
- Reliable transactions
- Advanced indexing
- JSONB support
- Window functions
- Materialized views
- Partitioning
- Strong concurrency control
- Extensive ecosystem

These capabilities align well with StudioHub's enterprise requirements.

---

# ORM Integration

StudioHub uses Django ORM as the primary data access layer.

The architecture leverages:

- Models
- QuerySets
- Managers
- Selectors
- Transactions
- Migrations

Raw SQL should be reserved for cases where ORM-generated queries cannot meet performance or functional requirements.

---

# Schema Design Principles

Database schema design should emphasize:

- Normalization where appropriate
- Clear foreign key relationships
- Explicit constraints
- Consistent naming conventions
- UUID primary identifiers
- Soft deletion where required
- Audit metadata

Schema evolution should be managed exclusively through Django migrations.

---

# Performance Strategy

Performance optimizations include:

- Appropriate indexing
- Query optimization
- Selective eager loading
- Connection pooling
- Read-only selectors
- Pagination
- Caching

Database optimization should be guided by profiling and production metrics.

---

# Transactions

Business transactions should be managed by the service layer.

Transaction boundaries should:

- Be explicit
- Remain short-lived
- Avoid unnecessary locking
- Roll back on failure
- Publish events only after successful commits

This approach preserves data consistency across domains.

---

# High Availability

Future enterprise deployments may include:

- Streaming replication
- Read replicas
- Automated failover
- Point-in-time recovery
- Backup automation
- Multi-region replication

These capabilities will be introduced as operational requirements evolve.

---

# Backup Strategy

Production environments should implement:

- Automated daily backups
- Point-in-time recovery (PITR)
- Backup verification
- Encrypted backup storage
- Disaster recovery testing

Backups are a critical operational responsibility.

---

# Security

Database security includes:

- Encrypted network connections
- Least-privilege access
- Secret management
- Regular patching
- Audit logging
- Monitoring
- Backup encryption

Security controls should be reviewed regularly.

---

# Alternatives Considered

## MySQL

Advantages:

- Broad adoption
- Mature ecosystem

Disadvantages:

- Fewer advanced PostgreSQL features
- Less flexible JSON capabilities
- Weaker support for certain analytical queries

Rejected.

---

## SQLite

Advantages:

- Extremely simple
- Zero configuration

Disadvantages:

- Not suitable for enterprise concurrency
- Limited scalability
- Development use only

Rejected for production.

---

## NoSQL Database

Advantages:

- Flexible schemas
- Horizontal scaling

Disadvantages:

- Weak transactional guarantees
- Complex relational modeling
- Increased application complexity

Rejected because StudioHub primarily manages highly relational business data.

---

# Consequences

## Positive

- Strong consistency
- Mature ecosystem
- Excellent Django integration
- Advanced SQL features
- Long-term scalability
- Enterprise reliability

## Negative

- Requires database administration
- More operational complexity than embedded databases
- Performance tuning expertise may be required at scale

The benefits significantly outweigh the operational costs.

---

# Implementation Guidelines

- Use Django migrations for schema changes.
- Prefer UUID primary keys.
- Index frequently queried fields.
- Keep transactions concise.
- Avoid unnecessary raw SQL.
- Profile queries before optimization.
- Review indexes periodically.

---

# Compliance

Architecture reviews should verify:

- PostgreSQL remains the authoritative data store.
- Migrations are the only schema modification mechanism.
- Queries follow performance best practices.
- Transaction management remains in the service layer.
- Backup and recovery procedures are documented and tested.

---

# Related ADRs

- ADR-0001 — Repository Structure
- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0007 — Background Processing (Celery & Redis)

---

# References

- `docs/03-backend/database.md`
- `docs/06-infrastructure/postgresql.md`
- `docs/07-deployment/database-migrations.md`
- `docs/11-operations/backup-recovery.md`
- `docs/13-roadmap/backend-roadmap.md`