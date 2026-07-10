# Permissions

## Overview

The Permission system is responsible for authorization throughout StudioHub. It determines **who can perform which actions on which resources**.

StudioHub implements a flexible Role-Based Access Control (RBAC) model with fine-grained permissions that can be extended to support Attribute-Based Access Control (ABAC) where necessary.

The Permission layer integrates closely with the Identity, Organization, and Production modules to provide enterprise-grade security.

---

# Objectives

The Permission system is responsible for:

- Authorization
- Role-Based Access Control (RBAC)
- Object-Level Permissions
- Organization-Level Access
- Module-Level Permissions
- API Authorization
- UI Feature Authorization
- Workflow Authorization

---

# Permission Architecture

```text
User
 │
 ▼
Membership
 │
 ▼
Role
 │
 ▼
Permission
 │
 ▼
Module
 │
 ▼
Category
 │
 ▼
Action
```

---

# Permission Hierarchy

Permissions follow a hierarchical structure.

```text
Module

↓

Category

↓

Action
```

Example

```text
Production

↓

Shot

↓

CREATE

READ

UPDATE

DELETE

APPROVE

EXPORT
```

---

# Permission Components

## Module

Represents a major business domain.

Examples

- Core
- Identity
- Organization
- Production

---

## Category

Represents a business entity.

Examples

- User
- Organization
- Department
- Team
- Project
- Shot
- Task
- Version

---

## Action

Represents an operation.

Common actions

```text
CREATE

READ

UPDATE

DELETE

LIST

EXPORT

IMPORT

APPROVE

ARCHIVE

RESTORE

ASSIGN

PUBLISH
```

---

# Permission Resolution

Authorization follows this flow.

```text
HTTP Request

↓

Authentication

↓

Load User

↓

Load Membership

↓

Load Roles

↓

Load Permissions

↓

Permission Evaluation

↓

Allow / Deny
```

---

# Role-Based Access Control

Roles group related permissions.

Example

```text
Administrator

↓

All Permissions
```

```text
Production Manager

↓

Projects

Shots

Tasks

Reviews
```

```text
Artist

↓

Assigned Tasks

Assigned Versions
```

---

# Organization Scope

Permissions are evaluated within an organization.

```text
Organization

↓

Membership

↓

Role

↓

Permission
```

Users may have different roles in different organizations.

Example

```text
Studio A

↓

Supervisor
```

```text
Studio B

↓

Artist
```

---

# Object-Level Permissions

Some operations require access to a specific resource.

Examples

- Update assigned task
- Approve owned review
- Edit own version
- Archive department

Object-level checks are performed after role evaluation.

---

# API Authorization

Every protected endpoint should validate permissions.

```text
Client

↓

JWT Authentication

↓

Permission Class

↓

Business Service

↓

Continue
```

Authorization should occur before business logic execution.

---

# Permission Classes

Typical permission classes include:

- IsAuthenticated
- IsOrganizationMember
- IsOrganizationAdmin
- HasPermission
- HasObjectPermission
- IsSuperUser

Custom permission classes should remain reusable.

---

# Workflow Permissions

Business workflows may require elevated permissions.

Examples

- Approve Version
- Publish Asset
- Archive Project
- Invite Organization Member
- Delete User

Workflow permissions should be enforced in both the API layer and business services.

---

# UI Authorization

Permissions also determine frontend behavior.

Examples

- Show or hide navigation items
- Enable or disable buttons
- Restrict page access
- Hide administrative features

UI authorization improves user experience but never replaces backend authorization.

---

# Auditing

Permission-sensitive operations should generate audit events.

Examples

- Permission Granted
- Permission Revoked
- Role Assigned
- Role Removed
- Unauthorized Access Attempt

Audit records support compliance and security investigations.

---

# Best Practices

- Apply the principle of least privilege.
- Assign permissions through roles whenever possible.
- Keep permission names consistent.
- Scope permissions by organization.
- Validate permissions before executing business logic.
- Log privileged operations.
- Avoid hard-coded permission checks.

---

# Anti-Patterns

Avoid:

- Business logic inside permission classes
- Hard-coded user IDs
- Duplicate permission checks
- Trusting frontend authorization
- Bypassing organization scope
- Granting excessive permissions

---

# Testing

Permission tests should verify:

- Role assignment
- Permission inheritance
- Organization isolation
- Object-level access
- Unauthorized requests
- Administrative privileges
- API authorization

---

# Related Documents

- authentication.md
- identity.md
- organization.md
- services.md
- validators.md
- ../02-architecture/api-architecture.md
- ../02-architecture/service-layer.md
```