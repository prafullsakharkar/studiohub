# Database Design

## Overview

StudioHub is built on PostgreSQL and follows a normalized, domain-driven database design. Each business domain owns its data model while sharing common enterprise capabilities through the Core framework.

The database is designed to support enterprise-scale VFX production with high data integrity, auditability, and performance.

---

# Design Goals

- Normalize business data
- Maintain clear domain ownership
- Ensure referential integrity
- Support horizontal feature growth
- Optimize read and write performance
- Enable auditability and soft deletion

---

# Domain Ownership

```text
Core
 ├── Base Models
 ├── Audit
 ├── Metadata
 └── Events

Identity
 ├── User
 ├── Role
 ├── Permission
 └── MFA

Organization
 ├── Organization
 ├── Department
 ├── Office
 ├── Team
 └── Membership

Production
 ├── Project
 ├── Sequence
 ├── Shot
 ├── Task
 ├── Version
 └── Publish
```

Each domain manages its own tables and relationships.

---

# Base Models

Most entities inherit common fields from the Core module.

Typical inherited fields include:

- UUID
- created_at
- updated_at
- created_by
- updated_by
- deleted_at
- metadata

This provides consistency across all domains.

---

# Entity Relationships

Typical production hierarchy:

```text
Organization
      │
      ▼
Project
      │
      ▼
Sequence
      │
      ▼
Shot
      │
      ▼
Task
      │
      ▼
Version
```

---

# Primary Keys

StudioHub uses UUID primary keys for all major entities.

Benefits:

- Globally unique identifiers
- Safer external APIs
- Easier data migration
- Better distributed-system compatibility

---

# Soft Delete Strategy

Entities are not permanently removed.

Instead:

- deleted_at
- deleted_by
- is_deleted

are used to preserve historical information and audit trails.

---

# Auditing

Audit fields capture lifecycle information.

Typical fields:

- created_by
- updated_by
- deleted_by
- created_at
- updated_at
- deleted_at

This supports compliance and operational traceability.

---

# Metadata

Entities may store extensible metadata using structured fields.

Use cases include:

- Pipeline settings
- Third-party identifiers
- Studio-specific configuration
- Integration data

---

# Indexing Guidelines

Indexes should be added for:

- UUID
- Foreign Keys
- Frequently filtered fields
- Searchable codes
- Status fields
- Composite lookup fields

Avoid unnecessary indexes that slow write performance.

---

# Performance Considerations

- Normalize transactional data.
- Use `select_related()` and `prefetch_related()`.
- Index frequently queried columns.
- Avoid N+1 query problems.
- Archive historical production data when appropriate.

---

# Migration Strategy

Schema changes should:

1. Be backward compatible where possible.
2. Use Django migrations.
3. Preserve production data.
4. Be reviewed before deployment.
5. Include rollback planning for critical changes.

---

# Best Practices

- One model per business entity.
- Keep relationships explicit.
- Prefer UUID identifiers.
- Reuse Core base models.
- Keep schema independent of API representation.
- Document significant schema changes.

---

# Related Documents

- ddd.md
- manager-pattern.md
- queryset-pattern.md
- api-architecture.md
- service-layer.md
