# Summary

- [StudioHub Documentation](README.md)

---

# Documentation Modernization — Checkpoints

A concise summary of the documentation modernization work (Parts 1–3). These checkpoints were produced as part of the StudioHub docs refactor program and contain canonical artifacts and recommendations.

- Part 1 — Docs Audit & Governance
  - Artifact: [Documentation Audit & Refactor Plan](architecture/documentation-audit.md)
  - Outcome: full inventory of docs/, duplicate/conflict analysis, ADR audit, documentation debt, and a staged refactor plan. Recommended safe fixes (SUMMARY.md alignment) and documentation governance rules.

- Part 2 — Product & Domain
  - Artifact: [Product Vision](02-product/product-vision.md)
  - Artifacts: canonical domain package under docs/03-domain/ (production, asset, shot, task, version, review, publishing, delivery, scheduling, pipelines)
  - Outcome: authoritative domain model, bounded contexts, domain events, and an expanded glossary ([12-reference/glossary.md](12-reference/glossary.md)). These files establish the product and domain source-of-truth for Part 3.

- Part 3 — Technical Architecture (initial)
  - Artifact: [Technical Architecture Overview](04-architecture/overview.md)
  - Outcome: canonical architecture entry-point reconciling DDD, Clean Architecture, Layered Architecture and a modular-monolith approach tailored to Django. Contains: layer definitions, dependency rules, Django mapping, module layout recommendations, event rules, transaction guidance, shared-kernel policy, and Mermaid diagrams. Also lists next steps (import-boundary tests, ADR reconciliation, module README templates).

Recommended next actions

- Keep SUMMARY.md updated to reflect the canonical docs above (this file has been updated to surface the checkpoints).
- Create a Documentation Governance page (owners, ADR linkage, canonical location rules).
- Reconcile overlapping ADRs (especially event and shared-kernel ADRs) and record any exceptions.
- Add import-boundary tests and CI checks for documentation link validation.

---

# 01. Getting Started

- [Installation](01-getting-started/installation.md)
- [Quick Start](01-getting-started/quick-start.md)
- [Configuration](01-getting-started/configuration.md)
- [Environment](01-getting-started/environment.md)
- [Docker](01-getting-started/docker.md)
- [Development](01-getting-started/development.md)

---

# 02. Architecture

- [Architecture Overview](02-architecture/overview.md)
- [Core Architecture](02-architecture/core-architecture.md)
- [Layered Architecture](02-architecture/layered-architecture.md)
- [Clean Architecture](02-architecture/clean-architecture.md)
- [Modular Monolith](02-architecture/modular-monolith.md)
- [Domain-Driven Design](02-architecture/ddd.md)
- [Event System](02-architecture/event-system.md)
- [API Architecture](02-architecture/api-architecture.md)
- [Database Design](02-architecture/database-design.md)
- [Directory Structure](02-architecture/directory-structure.md)
- [Model Foundations](02-architecture/model-foundations.md)
- [Manager Pattern](02-architecture/manager-pattern.md)
- [QuerySet Pattern](02-architecture/queryset-pattern.md)
- [Service Layer](02-architecture/service-layer.md)
- [Selector Pattern](02-architecture/selector-pattern.md)
- [Validator Pattern](02-architecture/validator-pattern.md)

---

# 03. Domain

- [Production Domain — Overview](03-domain/production-domain.md)
- [Production Entities](03-domain/production-entities.md)
- [Production Workflows](03-domain/production-workflows.md)
- [Production Scheduling](03-domain/production-scheduling.md)
- [Production Events](03-domain/production-events.md)

---

# 03. Backend

- [Development Guide](03-backend/development-guide.md)
- [Models](03-backend/models.md)
- [Selectors](03-backend/selectors.md)
- [Services](03-backend/services.md)
- [Validators](03-backend/validators.md)
- [Events](03-backend/events.md)
- [Permissions](03-backend/permissions.md)
- [Authentication](03-backend/authentication.md)
- [Core App](03-backend/core.md)
- [Identity Domain](03-backend/identity.md)
- [Organization Domain](03-backend/organization.md)
- [Production Domain](03-backend/production.md)

---

# 04. Frontend

- [Overview](04-frontend/overview.md)
- [Project Structure](04-frontend/project-structure.md)
- [Routing](04-frontend/routing.md)
- [State Management](04-frontend/state-management.md)
- [API Client](04-frontend/api-client.md)
- [Authentication](04-frontend/authentication.md)
- [Components](04-frontend/components.md)
- [Forms](04-frontend/forms.md)
- [Tables](04-frontend/tables.md)
- [Layouts](04-frontend/layouts.md)
- [Themes](04-frontend/themes.md)

---

# 05. API

- [Overview](05-api/overview.md)
- [API Standards](05-api/api-standards.md)
- [Authentication](05-api/authentication.md)
- [Permissions](05-api/permissions.md)
- [Versioning](05-api/versioning.md)
- [Routing](05-api/routing.md)
- [Views](05-api/views.md)
- [Serializers](05-api/serializers.md)
- [Responses](05-api/responses.md)
- [Error Handling](05-api/error-handling.md)
- [Errors](05-api/errors.md)
- [Pagination](05-api/pagination.md)
- [Filtering](05-api/filtering.md)
- [Sorting](05-api/sorting.md)
- [OpenAPI](05-api/openapi.md)
- [Organizations](05-api/organizations.md)
- [Users](05-api/users.md)
- [Departments](05-api/departments.md)
- [Offices](05-api/offices.md)

---

# 06. Infrastructure

- [Overview](06-infrastructure/overview.md)
- [PostgreSQL](06-infrastructure/postgres.md)
- [Redis](06-infrastructure/redis.md)
- [Celery](06-infrastructure/celery.md)
- [Docker](06-infrastructure/docker.md)
- [Docker Compose](06-infrastructure/docker-compose.md)
- [Nginx](06-infrastructure/nginx.md)
- [Networking](06-infrastructure/networking.md)
- [Storage](06-infrastructure/storage.md)
- [Logging](06-infrastructure/logging.md)
- [Monitoring](06-infrastructure/monitoring.md)
- [Environments](06-infrastructure/environments.md)
- [Backup](06-infrastructure/backup.md)

---

# 07. Deployment

- [Overview](07-deployment/overview.md)
- [Production](07-deployment/production.md)
- [Staging](07-deployment/staging.md)
- [Local Development](07-deployment/local-development.md)
- [CI/CD](07-deployment/ci-cd.md)
- [Release Process](07-deployment/release-process.md)
- [Migration Guide](07-deployment/migration-guide.md)
- [Rollback](07-deployment/rollback.md)
- [Scaling](07-deployment/scaling.md)
- [Maintenance](07-deployment/maintenance.md)

---

# 08. Development

- [Overview](08-development/overview.md)
- [Getting Started](08-development/getting-started.md)
- [Coding Standards](08-development/coding-standards.md)
- [Python Guidelines](08-development/python-guidelines.md)
- [Django Guidelines](08-development/django-guidelines.md)
- [React Guidelines](08-development/react-guidelines.md)
- [TypeScript Style Guide](08-development/typescript-style-guide.md)
- [Core App](08-development/core.md)
- [Identity](08-development/identity.md)
- [Organization](08-development/organization.md)
- [Production](08-development/production.md)
- [Testing](08-development/testing.md)
- [Performance](08-development/performance.md)
- [Debugging](08-development/debugging.md)
- [Git Workflow](08-development/git-workflow.md)
- [Branching Strategy](08-development/branching-strategy.md)
- [Contributing Guide](08-development/contributing-guide.md)
- [Documentation](08-development/documentation.md)
- [Project Structure](08-development/project-structure.md)

---

# 09. Testing

- [Testing Overview](09-testing/overview.md)
- [Unit Testing](09-testing/unit-testing.md)
- [Integration Testing](09-testing/integration-testing.md)
- [API Testing](09-testing/api-testing.md)
- [Performance Testing](09-testing/performance-testing.md)

---

# 10. Security

- [Overview](10-security/overview.md)
- [Authentication](10-security/authentication.md)
- [JWT](10-security/jwt.md)
- [MFA](10-security/mfa.md)
- [Trusted Devices](10-security/trusted-devices.md)
- [Authorization](10-security/authorization.md)
- [Permissions](10-security/permissions.md)
- [Roles](10-security/roles.md)
- [API Security](10-security/api-security.md)
- [Security Headers](10-security/security-headers.md)
- [Password Policy](10-security/password-policy.md)
- [Encryption](10-security/encryption.md)
- [Secrets Management](10-security/secrets-management.md)
- [Secure Coding](10-security/secure-coding.md)
- [Audit Logging](10-security/audit-logging.md)
- [Audit](10-security/audit.md)
- [Incident Response](10-security/incident-response.md)
- [Vulnerability Management](10-security/vulnerability-management.md)
- [Security Review](10-security/security-review.md)
- [Compliance](10-security/compliance.md)

---

# 11. Operations

- [Overview](11-operations/overview.md)
- [Monitoring](11-operations/monitoring.md)
- [Logging](11-operations/logging.md)
- [Backup & Recovery](11-operations/backup-recovery.md)
- [Disaster Recovery](11-operations/disaster-recovery.md)
- [Runbooks](11-operations/runbooks.md)
- [Operational Checklists](11-operations/operational-checklists.md)
- [Maintenance](11-operations/maintenance.md)
- [Capacity Planning](11-operations/capacity-planning.md)
- [Service Level Objectives](11-operations/service-level-objectives.md)
- [Risk Management](11-operations/risk-management.md)
- [Support](11-operations/support.md)
- [Governance](11-operations/governance.md)

---

# 12. Reference

- [Overview](12-reference/overview.md)
- [Architecture Decision Records](12-reference/architecture-decision-records.md)

---

# 13. Roadmap

- [Overview](13-roadmap/overview.md)
- [Project Phases](13-roadmap/project-phases.md)
- [Milestones](13-roadmap/milestones.md)
- [Backend Roadmap](13-roadmap/backend-roadmap.md)
- [Frontend Roadmap](13-roadmap/frontend-roadmap.md)
- [Infrastructure Roadmap](13-roadmap/infrastructure-roadmap.md)
- [Technical Debt](13-roadmap/technical-debt.md)
- [Future Features](13-roadmap/future-features.md)
- [Release Roadmap](13-roadmap/release-roadmap.md)
- [Changelog](13-roadmap/changelog.md)

---

# Architecture Decision Records (ADR)

- [ADR-0001 Repository Structure](adr/ADR-0001-repository-structure.md)
- [ADR-0002 Layered Architecture](adr/ADR-0002-layered-architecture.md)
- [ADR-0003 Service & Selector Pattern](adr/ADR-0003-service-selector-pattern.md)
- [ADR-0004 Domain-Driven Design](adr/ADR-0004-domain-driven-design.md)
- [ADR-0005 Event-Driven Architecture](adr/ADR-0005-event-driven-architecture.md) (superseded by ADR-0030)
- [ADR-0006 PostgreSQL as Primary Database](adr/ADR-0006-postgresql-as-primary-database.md)
- [ADR-0007 Background Processing with Celery & Redis](adr/ADR-0007-background-processing-celery-redis.md)
- [ADR-0008 API Design Principles](adr/ADR-0008-api-design-principles.md)
- [ADR-0009 Authentication & Authorization Strategy](adr/ADR-0009-authentication-and-authorization-strategy.md)
- [ADR-0010 Multi-Tenant Organization Model](adr/ADR-0010-multi-tenant-organization-model.md)
- [ADR-0011 Audit Logging Strategy](adr/ADR-0011-audit-logging-strategy.md)
- [ADR-0012 File & Asset Storage Strategy](adr/ADR-0012-file-and-asset-storage-strategy.md)
- [ADR-0013 UUID Primary Key Strategy](adr/ADR-0013-uuid-primary-key-strategy.md)
- [ADR-0014 Soft Delete Strategy](adr/ADR-0014-soft-delete-strategy.md)
- [ADR-0015 Caching Strategy](adr/ADR-0015-caching-strategy.md)
- [ADR-0016 Validation Architecture](adr/ADR-0016-validation-architecture.md)
- [ADR-0017 Permission & Authorization Model](adr/ADR-0017-permission-authorization-model.md)
- [ADR-0018 Event Bus Architecture](adr/ADR-0018-event-bus-architecture.md) (superseded by ADR-0030)
- [ADR-0019 API Versioning Strategy](adr/ADR-0019-api-versioning-strategy.md)
- [ADR-0020 Exception Handling Strategy](adr/ADR-0020-exception-handling-strategy.md)
- [ADR-0021 Configuration & Settings Management](adr/ADR-0021-configuration-settings-management.md)
- [ADR-0022 Logging & Observability Strategy](adr/ADR-0022-logging-observability-strategy.md)
- [ADR-0023 Search Indexing Strategy](adr/ADR-0023-search-indexing-strategy.md)
- [ADR-0024 Notification Architecture](adr/ADR-0024-notification-architecture.md)
- [ADR-0025 Intelligent Automation Architecture](adr/ADR-0025-intelligent-automation-architecture.md)
- [ADR-0026 Core Shared Kernel Boundary](adr/ADR-0026-core-shared-kernel-boundary.md)
- [ADR-0027 Core Public API Stability](adr/ADR-0027-core-public-api-stability.md)
- [ADR-0028 Bulk Operations Pattern](adr/ADR-0028-bulk-operations-pattern.md)
- [ADR-0029 Stub Data Elimination](adr/ADR-0029-stub-data-elimination.md)
- [ADR-0030 Domain Events and Event Bus](adr/ADR-0030-domain-events-and-event-bus.md)