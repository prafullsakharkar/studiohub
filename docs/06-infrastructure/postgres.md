# PostgreSQL

## Overview

StudioHub uses **PostgreSQL** as its primary relational database management system. PostgreSQL provides ACID-compliant transactions, advanced indexing, JSON support, powerful query capabilities, and excellent scalability, making it an ideal choice for enterprise VFX production management.

All persistent business data is stored in PostgreSQL, including organizations, users, permissions, projects, shots, tasks, versions, reviews, and production assets.

---

# Objectives

PostgreSQL provides:

- Reliable Data Storage
- ACID Transactions
- Data Integrity
- High Performance
- Advanced Indexing
- JSON Support
- Concurrency Control
- Enterprise Scalability

---

# Architecture

```text
               Django ORM
                    │
                    ▼
             QuerySet / Manager
                    │
                    ▼
              PostgreSQL
                    │
                    ▼
        Persistent Business Data
```

PostgreSQL is the single source of truth for all transactional data.

---

# Responsibilities

PostgreSQL is responsible for:

- Data Persistence
- Transactions
- Relationships
- Constraints
- Indexes
- Query Execution
- Backup & Recovery
- Data Consistency

Business rules remain in the application layer.

---

# Database Organization

StudioHub stores data for multiple domains.

```text
Core

Identity

Organization

Production

Future Modules
```

Each module owns its own database models while sharing a common database.

---

# Entity Relationships

Example hierarchy

```text
Organization

↓

Department

↓

Team

↓

User

↓

Project

↓

Sequence

↓

Shot

↓

Task

↓

Version
```

Relationships are enforced through foreign keys.

---

# UUID Strategy

StudioHub uses UUIDs for all business entities.

Example

```text
550e8400-e29b-41d4-a716-446655440000
```

Benefits

- Globally Unique
- Secure Public Identifiers
- Distributed System Friendly
- API Safe

Auto-incrementing IDs should remain internal.

---

# Transactions

Critical operations should execute inside database transactions.

Examples

- User Creation
- Project Creation
- Permission Assignment
- Organization Membership
- Asset Publishing

Transactions ensure atomicity and consistency.

---

# Constraints

Use database constraints whenever possible.

Examples

- Primary Keys
- Foreign Keys
- Unique Constraints
- Check Constraints
- Not Null Constraints

Business validation complements database constraints.

---

# Indexing

Indexes should be created for:

- Primary Keys
- UUID Fields
- Foreign Keys
- Frequently Queried Fields
- Composite Search Fields

Avoid unnecessary indexes to reduce write overhead.

---

# Soft Deletes

StudioHub uses soft deletion for business entities.

Deleted records remain in the database and are excluded through QuerySets and Managers.

Benefits

- Auditability
- Data Recovery
- Historical Reporting

---

# Migrations

Schema changes are managed through Django migrations.

Migration workflow

```text
Model Changes

↓

makemigrations

↓

Review Migration

↓

migrate

↓

Database Updated
```

Migration files should always be committed to version control.

---

# Connection Management

Database connections should be managed through connection pooling.

Recommended options

- Django Persistent Connections
- PgBouncer (Production)

This improves performance under heavy workloads.

---

# Performance Optimization

Performance strategies include:

- Proper Indexing
- Query Optimization
- `select_related()`
- `prefetch_related()`
- QuerySet Optimization
- Pagination
- Database Profiling

Avoid unnecessary database queries.

---

# Backup Strategy

Regular backups should include:

- Full Database Backup
- Incremental Backup
- Point-in-Time Recovery (PITR)

Backups must be encrypted and stored securely.

---

# Security

Database security includes:

- Strong Authentication
- Encrypted Connections (SSL/TLS)
- Principle of Least Privilege
- Network Isolation
- Regular Updates
- Backup Encryption

Direct public access to PostgreSQL should never be allowed.

---

# Monitoring

Monitor:

- Active Connections
- Slow Queries
- Database Size
- Index Usage
- Lock Contention
- Replication Status (Future)
- Transaction Rate

Monitoring enables proactive maintenance.

---

# Scaling

Future scaling strategies

```text
Application

↓

Primary Database

↓

Read Replicas

↓

Analytics Database
```

Scaling should prioritize read-heavy workloads.

---

# Maintenance

Regular maintenance includes:

- VACUUM
- ANALYZE
- REINDEX (when required)
- Backup Verification
- Index Review
- Storage Monitoring

Automated maintenance should be scheduled during low-traffic periods.

---

# Best Practices

- Use UUID primary keys.
- Keep transactions short.
- Index frequently queried fields.
- Optimize QuerySets.
- Backup regularly.
- Use migrations for schema changes.
- Monitor database performance.

---

# Anti-Patterns

Avoid:

- Long-running transactions
- N+1 database queries
- Missing indexes
- Hard deletes for business data
- Manual schema changes
- Storing secrets in the database
- Exposing PostgreSQL publicly

---

# Testing

Database testing should verify:

- Migrations
- Constraints
- Transactions
- Query Performance
- Index Usage
- Data Integrity
- Backup & Restore
- Soft Delete Behavior

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- redis.md
- celery.md
- storage.md
- backup.md
- monitoring.md
- ../03-backend/database.md
- ../03-backend/models.md
```