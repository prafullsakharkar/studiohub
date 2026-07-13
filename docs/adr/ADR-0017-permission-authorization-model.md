# ADR-0017: Permission & Authorization Model

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is a multi-tenant enterprise platform where users perform different responsibilities across organizations and productions.

A single user may simultaneously act as:

- Studio Administrator
- Production Manager
- Department Lead
- Supervisor
- Artist
- Reviewer
- Client
- Vendor

Permissions vary depending on:

- Organization
- Team
- Department
- Project
- Membership
- Assigned responsibilities

The platform requires a flexible authorization model that is scalable, maintainable, and extensible.

---

# Decision

StudioHub adopts a **Role-Based Access Control (RBAC)** model with organization-scoped permissions and support for future Attribute-Based Access Control (ABAC) extensions.

Authorization decisions are based on:

1. Authentication
2. Organization membership
3. Assigned roles
4. Granted permissions
5. Resource ownership (where applicable)
6. Business validation

Permission evaluation is performed by the authorization layer before business operations execute.

---

# Authorization Architecture

```text
Request

↓

Authentication

↓

Organization Context

↓

Membership Resolution

↓

Role Resolution

↓

Permission Resolution

↓

Business Validation

↓

Service Execution
```

Authorization precedes service execution for all protected operations.

---

# Core Components

The authorization model includes:

- User
- Organization
- Membership
- Role
- Permission
- RolePermission
- UserRole (or MembershipRole)
- Permission Resolver

Each component has a distinct responsibility.

---

# Roles

Roles represent collections of permissions.

Examples:

- Super Administrator
- Organization Administrator
- Project Manager
- Department Manager
- Lead Artist
- Artist
- Reviewer
- Client

Roles simplify permission assignment and administration.

---

# Permissions

Permissions represent atomic capabilities.

Examples:

```text
organization.view

organization.create

organization.update

organization.delete

project.view

project.manage

task.assign

asset.publish

review.approve

user.invite
```

Permissions should follow a consistent naming convention:

```text
<module>.<action>
```

---

# Membership

Permissions are evaluated within the context of an organization membership.

Typical relationship:

```text
User

↓

Organization Membership

↓

Role

↓

Permissions
```

A user may hold different roles in different organizations.

---

# Organization Isolation

Permission evaluation always occurs within an organization context.

Example:

```text
User A

Organization X
→ Administrator

Organization Y
→ Reviewer
```

Roles and permissions do not automatically cross tenant boundaries.

---

# Permission Resolution

The permission resolver performs evaluation in a predictable order:

1. Active account check
2. Authentication
3. Organization membership
4. Organization status
5. Assigned roles
6. Effective permissions
7. Resource-level rules
8. Business validation

Evaluation stops immediately when access is denied.

---

# Resource-Level Authorization

Some operations require ownership or contextual validation.

Examples:

- Assigned task editing
- Review approvals
- Asset ownership
- Department management

These checks supplement RBAC rather than replacing it.

---

# Permission Inheritance

Roles inherit permissions through explicit assignment.

Permission inheritance should remain simple and deterministic.

Complex hierarchical role inheritance is intentionally avoided to reduce ambiguity.

---

# Caching

Effective permission sets may be cached to improve performance.

Cache invalidation occurs when:

- Roles change
- Permissions change
- Membership changes
- Organization status changes

PostgreSQL remains the source of truth.

---

# Super Administrator

A platform-level Super Administrator may bypass organization-scoped authorization for operational purposes.

Use of elevated privileges should:

- Be tightly controlled
- Be audited
- Require administrative authorization

Super Administrator access should not be used for routine business operations.

---

# Audit

Authorization-related events should be audited.

Examples:

- Role assignment
- Permission modification
- Membership changes
- Access denials (where appropriate)
- Administrative overrides

Audit records support compliance and incident investigation.

---

# Future ABAC Support

The architecture is designed to accommodate additional policy checks based on attributes such as:

- Project status
- Department
- Asset classification
- Working hours
- Geographic region
- Contract type

RBAC remains the primary authorization mechanism.

---

# Security

Authorization must enforce:

- Tenant isolation
- Least privilege
- Explicit permission grants
- Deny-by-default behavior
- Separation of duties

Every protected operation requires explicit authorization.

---

# Testing

Authorization should be tested independently.

Tests should verify:

- Role assignments
- Permission resolution
- Tenant isolation
- Ownership rules
- Super Administrator behavior
- Permission caching
- Access denial scenarios

---

# Alternatives Considered

## User-Based Permissions Only

Advantages:

- Simple implementation

Disadvantages:

- Difficult administration
- Permission duplication
- Poor scalability

Rejected.

---

## Hierarchical Role Trees

Advantages:

- Flexible inheritance

Disadvantages:

- Complex reasoning
- Difficult debugging
- Hidden permission propagation

Rejected.

---

## Attribute-Based Access Control Only

Advantages:

- Extremely flexible

Disadvantages:

- Higher implementation complexity
- Harder administration
- Increased policy evaluation overhead

Deferred as an extension to RBAC.

---

# Consequences

## Positive

- Scalable authorization
- Organization isolation
- Centralized permission management
- Predictable permission resolution
- Improved maintainability
- Future extensibility

## Negative

- Additional authorization infrastructure
- Permission administration overhead
- Cache invalidation complexity

These trade-offs are appropriate for an enterprise multi-tenant platform.

---

# Implementation Guidelines

- Use roles to group permissions.
- Keep permissions atomic.
- Evaluate permissions within organization context.
- Apply deny-by-default semantics.
- Cache effective permissions where beneficial.
- Audit authorization changes.
- Keep permission names consistent.

---

# Compliance

Architecture reviews should verify:

- Authorization occurs before service execution.
- Roles remain organization-scoped.
- Permission names follow established conventions.
- Super Administrator access is audited.
- Tenant isolation is consistently enforced.
- Permission caches are invalidated correctly.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0009 — Authentication & Authorization Strategy
- ADR-0010 — Multi-Tenant Organization Model
- ADR-0011 — Audit Logging Strategy
- ADR-0015 — Caching Strategy
- ADR-0016 — Validation Architecture

---

# References

- `docs/03-backend/identity.md`
- `docs/03-backend/services.md`
- `docs/03-backend/selectors.md`
- `docs/05-api/authorization.md`
- `docs/10-security/access-control.md`