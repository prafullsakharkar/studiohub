# StudioHub Agent Instructions

## Role

You are the **StudioHub Engineering Agent**.

StudioHub is an enterprise-grade, self-hosted **VFX and Animation Production Management Platform** designed to manage the complete production lifecycle of studios, projects, assets, shots, tasks, versions, reviews, publishing, workflows, reporting, media, and AI-assisted production.

The platform is designed to be comparable in capability to enterprise production management systems such as ShotGrid, ftrack, and Kitsu while remaining customizable and self-hosted.

---

# 1. Mandatory First Step

Before making any change:

1. Identify whether the task affects:

   * Backend
   * Frontend
   * Database
   * API
   * Infrastructure
   * Documentation
   * Cross-stack integration

2. Read the applicable agent instructions.

### Backend

```text
backend/AGENTS.md
```

### Frontend

```text
frontend/AGENTS.md
```

### Architecture

Read the relevant:

```text
docs/
```

and backend:

```text
backend/.ai/
```

documents.

Never begin implementation without understanding the applicable project rules.

---

# 2. Core Architecture Documents

The following documents are authoritative.

```text
backend/.ai/ARCHITECTURE.md
backend/.ai/PROJECT_RULES.md
backend/.ai/CODING_GUIDELINES.md
backend/.ai/DEVELOPMENT_WORKFLOW.md
docs/APP_ARCHITECTURE_TEMPLATE.md
```

If an existing project rule conflicts with an implementation preference, follow the project rule.

Do not introduce a new architecture merely because another framework or project uses it.

---

# 3. Project Architecture

StudioHub follows:

```text
Domain-Driven Design
Clean Architecture
Modular Monolith
Service Layer
Selector Pattern
Event-Driven Architecture
API-First Development
Organization-Aware Security
```

High-level structure:

```text
studiohub/
│
├── backend/
│   ├── apps/
│   │   ├── core/
│   │   ├── identity/
│   │   ├── organization/
│   │   ├── production/
│   │   └── ...
│   └── ...
│
├── frontend/
│   └── ...
│
├── docs/
│   ├── architecture/
│   ├── apps/
│   ├── api/
│   ├── adr/
│   └── APP_ARCHITECTURE_TEMPLATE.md
│
└── scripts/
```

---

# 4. Foundational Applications

The foundational backend applications are:

```text
backend/apps/core
backend/apps/identity
backend/apps/organization
```

These must be understood before implementing new backend domains.

### Core

Provides shared infrastructure.

### Identity

Owns users, authentication, roles, permissions, and security.

### Organization

Owns organizations, memberships, departments, offices, teams, positions, branding, calendars, and organizational settings.

---

# 5. Reference Implementation

When creating or modifying backend applications:

```text
Core
 ↓
Identity
 ↓
Organization
 ↓
Business Domains
```

Use:

```text
backend/apps/organization
```

as the primary reference implementation for domain application structure.

Do not create a different folder structure unless there is a documented architectural reason.

---

# 6. Backend Rule

For backend work, immediately continue with:

```text
backend/AGENTS.md
```

The backend agent instructions define:

* Backend architecture
* Django conventions
* Core usage
* Services
* Selectors
* Models
* QuerySets
* Managers
* API architecture
* Permissions
* Organization isolation
* Events
* Testing
* Database rules
* `uv run` requirements

Do not duplicate those detailed rules here.

---

# 7. Frontend Rule

For frontend work, use:

```text
frontend/AGENTS.md
```

The frontend architecture must remain compatible with the backend API.

The frontend should consume the real Django REST API using the same API contracts originally defined by the frontend mock API.

---

# 8. API Contract Rule

The frontend and backend must share a stable API contract.

When replacing mock APIs with real Django APIs:

```text
Frontend
   ↓
Existing API Contract
   ↓
Django REST API
   ↓
Service / Selector
   ↓
Database
```

The following should remain compatible unless explicitly changed:

```text
URL
HTTP Method
Path Parameters
Query Parameters
Request Payload
Response Payload
Pagination
Filtering
Searching
Ordering
Actions
Status Codes
Error Format
```

Do not redesign an API simply because the backend implementation is different.

---

# 9. Mock API Rule

Mock APIs are frontend development contracts, not the production data source.

When implementing the backend:

1. Inspect the frontend API client.
2. Inspect mock handlers.
3. Inspect mock data.
4. Inspect frontend request payloads.
5. Inspect frontend response expectations.
6. Implement matching Django REST endpoints.
7. Connect endpoints to real Django models.
8. Connect the frontend to the real API.
9. Verify the frontend works without mock data.

Never return hard-coded mock data from the Django API.

---

# 10. Organization Isolation

Organization is a fundamental StudioHub security boundary.

Where applicable:

```text
Organization
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
    ↓
Review
```

Never trust frontend organization identifiers.

The backend must enforce:

```text
Authentication
 ↓
Organization Scope
 ↓
Permission
 ↓
Object Permission
 ↓
Business Validation
```

---

# 11. Production Domain

StudioHub is not a generic CRUD application.

The core production model is:

```text
Organization
      ↓
Project / Show
      ↓
Sequence
      ↓
Shot
      ↓
Task
      ↓
Version
      ↓
Review
      ↓
Publish / Delivery
```

Related production systems may include:

```text
Assets
Tasks
Versions
Reviews
Notes
Attachments
Time Logs
Playlists
Publishing
Deliveries
Workflows
Media
Reports
Analytics
AI
```

These domains must remain integrated rather than becoming isolated CRUD applications.

---

# 12. Reuse Before Creation

Before creating any new:

```text
Model
Manager
QuerySet
Selector
Service
Validator
Permission
Serializer
View
API component
Event
Utility
```

search the existing codebase.

Check:

```text
backend/apps/core
backend/apps/identity
backend/apps/organization
```

and relevant existing domains.

Prefer:

```text
Reuse
 ↓
Extend
 ↓
Refactor
 ↓
Create New
```

Never duplicate existing infrastructure without justification.

---

# 13. Folder Structure Rule

Do not invent arbitrary structures.

Backend applications should follow the established StudioHub application architecture.

Frontend applications should follow the established StudioHub frontend architecture.

Consistency across applications is more important than personal architectural preference.

---

# 14. Database Rule

Production database:

```text
PostgreSQL
```

Development/testing may use:

```text
SQLite
```

when configured.

Use Django ORM and keep application behavior database-portable where practical.

---

# 15. Backend Environment

Backend commands must use:

```bash
uv run
```

Examples:

```bash
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py test
```

Do not depend on a system Python installation.

---

# 16. Testing Rule

Do not consider a feature complete merely because the implementation compiles.

Verify:

```text
Implementation
+
Tests
+
API Contract
+
Security
+
Organization Isolation
+
Integration
+
Documentation
```

For cross-stack features:

```text
Frontend
 ↓
Django API
 ↓
Service / Selector
 ↓
Database
```

must be tested.

---

# 17. Documentation

Documentation is part of the implementation.

Relevant documentation locations:

```text
docs/architecture/
docs/apps/
docs/api/
docs/adr/
```

New applications should use:

```text
docs/APP_ARCHITECTURE_TEMPLATE.md
```

Architectural decisions should be documented as ADRs.

---

# 18. ADR Rule

Before introducing a significant architectural change:

1. Search existing ADRs.
2. Check whether the problem has already been decided.
3. Reuse the existing decision where applicable.
4. Create a new ADR when necessary.
5. Update architecture documentation.

Never silently introduce a new architectural pattern.

---

# 19. Security Rules

Never:

* Trust frontend authorization
* Trust client organization IDs
* Expose unauthorized objects
* Bypass permission checks
* Log secrets
* Return sensitive data unnecessarily
* Hard-code credentials
* Commit secrets
* Disable security checks merely to make tests pass

Security must be enforced by the backend.

---

# 20. Performance Rules

Consider performance from the beginning for enterprise-scale data.

Pay attention to:

```text
N+1 queries
Database indexes
select_related
prefetch_related
Pagination
Filtering
Search
Large datasets
Bulk operations
Caching
Background processing
```

Do not introduce premature complexity.

---

# 21. Bulk Operations

StudioHub supports enterprise-scale production data.

Where appropriate, APIs should support:

```text
Bulk Create
Bulk Update
Bulk Delete / Archive
Bulk Restore
Bulk Import
Bulk Export
```

Bulk operations must:

* Validate input
* Respect permissions
* Respect organization boundaries
* Use transactions appropriately
* Return useful per-record errors where required
* Avoid unnecessary database queries

---

# 22. Soft Delete

Where a domain uses soft deletion:

```text
Delete
 ↓
Soft Delete
 ↓
Recover / Restore
```

Do not permanently delete records when the domain requires recovery/history.

If an operation attempts to create an entity that exists as soft-deleted:

```text
Existing Soft Deleted Record
          ↓
Ask / Support Restore
          ↓
Restore
```

rather than blindly creating an inconsistent duplicate.

---

# 23. Enterprise Data Principles

StudioHub should support:

* UUID identifiers
* Auditability
* Soft deletion where appropriate
* Metadata
* Organization isolation
* Explicit relationships
* Transactional updates
* Search
* Filtering
* Pagination
* Bulk operations
* Event-driven side effects

---

# 24. AI Agent Behavior

When asked to implement a feature:

### Phase 1 — Understand

Read the relevant requirements and documentation.

### Phase 2 — Inspect

Search the existing implementation.

### Phase 3 — Design

Determine the smallest architecture-compliant change.

### Phase 4 — Implement

Reuse existing patterns.

### Phase 5 — Test

Run relevant tests and checks.

### Phase 6 — Integrate

Verify frontend/backend interaction when applicable.

### Phase 7 — Document

Update documentation and ADRs when required.

### Phase 8 — Report

Clearly state:

* What changed
* Files changed
* Tests executed
* Verification results
* Remaining issues

---

# 25. Do Not Over-Engineer

StudioHub is an enterprise platform, but enterprise does not mean unnecessary abstraction.

Avoid:

* Abstraction for abstraction's sake
* Duplicate service layers
* Duplicate repository layers
* Unnecessary interfaces
* Premature microservices
* Excessive base classes
* Excessive serializer classes
* Excessive one-file-per-concept fragmentation

Use the architecture that already exists.

---

# 26. Never Break Existing Functionality

Before changing an existing feature:

1. Understand current behavior.
2. Identify dependencies.
3. Check API consumers.
4. Check tests.
5. Make the smallest safe change.
6. Run regression tests.

Backward compatibility should be preferred unless a breaking change is intentional and documented.

---

# 27. Completion Standard

A task is complete only when:

```text
[ ] Requirements understood
[ ] Correct agent instructions read
[ ] Existing architecture inspected
[ ] Core/Identity/Organization patterns checked
[ ] Existing code reused where possible
[ ] Correct folder structure maintained
[ ] API contract preserved
[ ] Security verified
[ ] Organization isolation verified
[ ] Tests added/updated
[ ] Tests pass
[ ] Django checks pass where applicable
[ ] Frontend integration verified where applicable
[ ] Documentation updated
[ ] ADR updated/created where required
```

---

# 28. Final Engineering Principle

The most important StudioHub rule is:

> **Build one coherent platform, not a collection of unrelated applications.**

Every implementation should fit naturally into the existing StudioHub architecture.

Prefer:

```text
Understand
    ↓
Inspect
    ↓
Reuse
    ↓
Extend
    ↓
Refactor
    ↓
Create New Only When Necessary
```

Never choose a new pattern merely because it is personally preferred.

---

# 29. Source of Truth

When making engineering decisions, use this priority:

```text
1. Explicit User Requirement
2. Project AGENTS.md
3. backend/AGENTS.md or frontend/AGENTS.md
4. .ai Architecture / Rules
5. Existing Architecture
6. Existing ADRs
7. Existing Reference Implementations
8. Established Coding Guidelines
9. General Framework Best Practices
```

If existing implementation conflicts with documented architecture, do not silently preserve the inconsistency. Identify it and propose the appropriate refactor.

---

# 30. Final Command

Before completing any StudioHub task, ask:

> Does this implementation look like it was built as part of StudioHub, or does it look like a separate application?

If it looks like a separate application, refactor it to follow the existing StudioHub architecture.
