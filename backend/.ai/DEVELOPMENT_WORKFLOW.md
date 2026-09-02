# StudioHub Backend Development Workflow

## 1. Purpose

This document defines the standard workflow for implementing StudioHub backend features.

Every feature should follow this lifecycle:

```text
Understand
 ↓
Analyze
 ↓
Design
 ↓
Implement
 ↓
Test
 ↓
Verify
 ↓
Document
```

---

# 2. Step 1 — Read Rules

Before coding, read:

```text
.roo/rules/
.ai/ARCHITECTURE.md
.ai/PROJECT_RULES.md
.ai/CODING_GUIDELINES.md
.ai/DEVELOPMENT_WORKFLOW.md
```

Also read relevant documentation.

---

# 3. Step 2 — Analyze Existing Architecture

Inspect:

```text
apps/core
apps/identity
apps/organization
```

Then inspect the closest existing domain implementation.

---

# 4. Step 3 — Search Before Creating

Search the repository for:

* existing models
* serializers
* services
* selectors
* validators
* permissions
* API endpoints
* events
* tests

Reuse existing implementations whenever possible.

---

# 5. Step 4 — Define Domain

Identify:

```text
Entities
Relationships
Business Rules
States
Events
Permissions
Organization Scope
```

---

# 6. Step 5 — Define API Contract

For frontend-driven features document:

```text
Endpoint
Method
Request
Response
Query Parameters
Errors
Permissions
Actions
```

The API contract must be stable.

---

# 7. Step 6 — Design Models

Determine:

```text
Models
Fields
Relationships
Constraints
Indexes
Organization Scope
```

Reuse Core bases.

---

# 8. Step 7 — Implement Persistence

Implement:

```text
Model
QuerySet
Manager
```

where required.

Keep database concerns separate from business workflows.

---

# 9. Step 8 — Implement Selectors

Implement read operations.

Optimize queries appropriately.

---

# 10. Step 9 — Implement Services

Implement state-changing operations.

Use transactions where required.

---

# 11. Step 10 — Implement Validators

Separate generic validation from domain-specific business rules.

---

# 12. Step 11 — Implement Events

Identify business events.

Implement handlers only when required.

---

# 13. Step 12 — Implement API

Implement:

```text
Serializer
View/ViewSet
URL
Permission
Filter
Pagination
```

using Core infrastructure.

---

# 14. Step 13 — Implement Tests

Test:

```text
Model
QuerySet
Selector
Service
Serializer
API
Permission
Organization Isolation
Events
```

where applicable.

---

# 15. Step 14 — Run Checks

Always run:

```bash
uv run python manage.py check
uv run python manage.py makemigrations --check
uv run python manage.py test
```

Run project-specific lint/type-check commands when configured.

---

# 16. Step 15 — Integration Verification

For frontend features verify:

```text
React
 ↓
API Client
 ↓
Django API
 ↓
Service / Selector
 ↓
Database
```

When mock APIs exist, verify the real Django API against the mock API contract.

---

# 17. Step 16 — Security Verification

Verify:

```text
Authentication
Authorization
Organization Isolation
Object Permissions
Business Validation
```

---

# 18. Step 17 — Performance Verification

Check for:

* N+1 queries
* unnecessary queries
* missing indexes
* excessive serialization
* inefficient filtering

---

# 19. Step 18 — Documentation

Update:

```text
docs/apps/
docs/api/
docs/architecture/
docs/adr/
```

when relevant.

---

# 20. Step 19 — Final Review

Before declaring completion:

```text
[ ] Rules followed
[ ] Architecture followed
[ ] Existing code reused
[ ] Correct folder structure
[ ] Models correct
[ ] Services correct
[ ] Selectors correct
[ ] API correct
[ ] Permissions correct
[ ] Organization isolation correct
[ ] Tests pass
[ ] Django check passes
[ ] Documentation updated
```

---

# 21. Architectural Change Workflow

If implementation requires a new architectural decision:

```text
Identify Problem
 ↓
Review Existing ADRs
 ↓
Create ADR
 ↓
Approve/Accept Decision
 ↓
Implement
 ↓
Update Architecture Documentation
```

Do not silently introduce architectural changes.

---

# 22. Definition of Done

A feature is complete only when:

```text
Code
+
Tests
+
Security
+
API Contract
+
Documentation
+
Architecture Compliance
```

are complete.
