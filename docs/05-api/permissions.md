# API Permissions

## Overview

StudioHub uses a centralized permission system to secure every API endpoint. Authentication identifies **who** the user is, while authorization determines **what** the user is allowed to do.

Authorization is based on:

- Organization Membership
- Roles
- Permissions
- Object-Level Access
- Business Rules

All authorization decisions are enforced on the server. Frontend permission checks are used only to improve user experience and must never replace backend authorization.

---

# Objectives

The API Permission system provides:

- Endpoint Authorization
- Role-Based Access Control (RBAC)
- Object-Level Permissions
- Organization-Level Security
- Resource Ownership Validation
- Custom Permission Policies
- Workflow Authorization

---

# Authorization Flow

```text
HTTP Request
      │
      ▼
Authentication
      │
      ▼
Load User
      │
      ▼
Load Organization Membership
      │
      ▼
Load Roles
      │
      ▼
Load Permissions
      │
      ▼
Permission Evaluation
      │
      ▼
APIView
      │
      ▼
Business Service
```

---

# Permission Layers

StudioHub evaluates permissions at multiple levels.

```text
Authentication

↓

Organization Membership

↓

Role

↓

Permission

↓

Object-Level Permission

↓

Business Validation
```

Each layer must succeed before the request is processed.

---

# Permission Components

## Authentication

Ensures the request is made by an authenticated user.

Example

```python
IsAuthenticated
```

---

## Organization Membership

Verifies the user belongs to the active organization.

Example

```text
User

↓

Organization

↓

Membership

↓

Role
```

Users cannot access resources belonging to organizations where they are not members.

---

## Role-Based Access

Roles group related permissions.

Example

```text
Studio Administrator

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

Versions
```

---

## Permission-Based Access

Permissions define allowed actions.

Example

```text
Project

↓

CREATE

READ

UPDATE

DELETE

ARCHIVE

EXPORT
```

---

## Object-Level Permissions

Some resources require additional ownership validation.

Examples

- Assigned Task
- Assigned Review
- Owned Version
- Department Manager
- Organization Owner

Example

```text
User

↓

Task

↓

Assigned User

↓

Allow
```

---

# Permission Evaluation

Example

```text
User

↓

Login

↓

Organization Membership

↓

Role

↓

Permission

↓

Object Ownership

↓

Access Granted
```

---

# Permission Classes

StudioHub provides reusable permission classes.

Common examples

```text
IsAuthenticated

IsOrganizationMember

IsOrganizationAdmin

HasPermission

HasObjectPermission

IsOwner

IsSuperUser
```

Projects may introduce additional domain-specific permission classes.

---

# CRUD Permissions

Typical permission mapping

| Action | Permission |
|----------|------------|
| List | READ |
| Retrieve | READ |
| Create | CREATE |
| Update | UPDATE |
| Delete | DELETE |
| Archive | ARCHIVE |
| Restore | RESTORE |
| Export | EXPORT |

---

# Custom Actions

Non-CRUD endpoints require dedicated permissions.

Examples

```text
Approve Review

Publish Version

Assign Task

Invite Member

Archive Project

Restore Project
```

Each custom action should define an explicit permission requirement.

---

# Organization Isolation

Every request must remain scoped to a single organization.

Example

```text
Organization A

↓

Departments

Teams

Projects
```

Users cannot access resources from another organization without an active membership.

---

# Service Layer Validation

Permissions should be validated in both:

- API Layer
- Business Service Layer

This prevents unauthorized access through internal service calls or background tasks.

---

# Permission Denied Response

Example

```json
{
    "success": false,
    "code": "permission_denied",
    "message": "You do not have permission to perform this action."
}
```

HTTP Status

```text
403 Forbidden
```

---

# Audit Logging

Permission-sensitive operations should generate audit events.

Examples

```text
Permission Granted

Permission Revoked

Role Assigned

Role Removed

Unauthorized Access Attempt
```

Audit logs improve security monitoring and compliance.

---

# Best Practices

- Enforce permissions on every protected endpoint.
- Keep permission classes reusable.
- Validate organization membership first.
- Apply object-level checks when required.
- Perform authorization before business logic.
- Log privileged operations.

---

# Anti-Patterns

Avoid:

- Authorization in serializers
- Hard-coded user IDs
- Trusting frontend permission checks
- Bypassing organization scope
- Embedding business logic in permission classes
- Duplicating permission checks

---

# Testing

Permission tests should verify:

- Authentication requirements
- Organization membership
- Role-based access
- Object-level authorization
- CRUD permissions
- Custom action permissions
- Unauthorized access
- Cross-organization isolation

---

# Related Documents

- overview.md
- authentication.md
- views.md
- error-handling.md
- ../03-backend/permissions.md
- ../03-backend/authentication.md
- ../03-backend/services.md