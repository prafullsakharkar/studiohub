# Database Migrations

## Overview

Database migrations are a controlled mechanism for evolving the StudioHub database schema while preserving existing data.

Every schema modification—including creating tables, modifying columns, adding indexes, constraints, or relationships—must be managed through Django migrations.

Database migrations are treated as part of the application source code and must follow the same review, testing, and deployment process as any other code change.

---

# Objectives

The migration strategy provides:

- Version Controlled Database Schema
- Safe Schema Evolution
- Data Integrity
- Automated Deployment
- Rollback Planning
- Team Collaboration
- Production Safety
- Repeatable Deployments

---

# Migration Lifecycle

```text
Model Change

        │

        ▼

Create Migration

        │

        ▼

Review Migration

        │

        ▼

Run Local Migration

        │

        ▼

Commit Migration

        │

        ▼

CI Validation

        │

        ▼

Staging

        │

        ▼

Production
```

---

# Migration Workflow

Typical workflow

```text
Modify Models

↓

makemigrations

↓

Review Generated Migration

↓

Run migrate

↓

Verify Application

↓

Commit Migration

↓

Deploy
```

---

# Creating Migrations

Generate migrations

```bash
python manage.py makemigrations
```

Generate migrations for a specific application

```bash
python manage.py makemigrations identity

python manage.py makemigrations organization

python manage.py makemigrations production
```

Always review generated migration files before committing.

---

# Applying Migrations

Run all pending migrations

```bash
python manage.py migrate
```

Apply a specific application

```bash
python manage.py migrate identity
```

Verify migration status

```bash
python manage.py showmigrations
```

---

# Migration Structure

Example

```text
apps/

identity/

migrations/

0001_initial.py

0002_add_mfa.py

0003_user_settings.py
```

Migration filenames should remain automatically generated.

---

# Schema Changes

Typical schema changes include:

- Create Tables
- Modify Columns
- Rename Fields
- Remove Fields
- Add Constraints
- Create Indexes
- Foreign Keys
- Many-to-Many Relationships

Every schema modification must be represented by a migration.

---

# Data Migrations

Data migrations should be used when existing data must be transformed.

Examples

- Populate New Columns
- Rename Values
- Convert Enumerations
- Normalize Data
- Merge Records

Business logic should remain outside migration files whenever possible.

---

# Migration Dependencies

Django automatically tracks migration dependencies.

```text
0001_initial

↓

0002_roles

↓

0003_permissions

↓

0004_mfa
```

Dependencies should never be modified manually unless absolutely necessary.

---

# Production Migration Process

Recommended workflow

```text
Backup Database

↓

Deploy Application

↓

Run Migrations

↓

Verify Schema

↓

Run Health Checks

↓

Enable Traffic
```

Backups should always be completed before applying production migrations.

---

# Large Migrations

Large migrations should be planned carefully.

Examples

- Large Tables
- Data Transformations
- Index Creation
- Column Renames
- Table Splits

Recommended practices

- Perform during maintenance windows
- Execute in multiple stages
- Minimize locking
- Monitor execution time

---

# Backward Compatibility

Applications should remain compatible during deployments whenever possible.

Recommended approach

```text
Add Column

↓

Deploy Application

↓

Backfill Data

↓

Switch Application

↓

Remove Legacy Column
```

Avoid breaking changes in a single deployment.

---

# Migration Validation

Verify

- Migration Applies Successfully
- Schema Correct
- Data Preserved
- Constraints Valid
- Performance Acceptable
- Application Functional

Migration validation should occur in staging before production.

---

# Rollback Considerations

Every migration should consider rollback.

Questions

- Can it be reversed?
- Will data be lost?
- Does rollback require restoration?
- Are backups available?

Not all migrations are safely reversible.

---

# Migration Review Checklist

Review

- Generated SQL
- Naming
- Dependencies
- Constraints
- Indexes
- Data Safety
- Performance Impact

Migration files should be reviewed during code review.

---

# CI Validation

The CI pipeline should verify:

- Migration Generation
- Migration Consistency
- Fresh Database Creation
- Upgrade Path
- Test Execution

CI should fail if migrations are missing.

---

# Monitoring

After production migration monitor:

- Migration Duration
- Database Locks
- Query Performance
- Application Errors
- Database CPU
- Slow Queries

Unexpected degradation should trigger investigation.

---

# Best Practices

- Commit every migration.
- Review generated SQL.
- Test migrations locally.
- Validate in staging.
- Backup production databases.
- Keep migrations small.
- Document complex migrations.

---

# Anti-Patterns

Avoid:

- Editing applied migrations
- Deleting committed migrations
- Manual schema changes
- Skipping migration reviews
- Combining unrelated schema changes
- Running production migrations without backups

---

# Related Documents

- overview.md
- local-development.md
- staging.md
- production.md
- ci-cd.md
- release-process.md
- rollback.md
- scaling.md
- maintenance.md
- ../06-infrastructure/postgres.md
- ../10-security/backup.md