# Identity Module

## Overview

The Identity module is responsible for authentication, authorization, user lifecycle management, and platform security. It provides a centralized identity system that is shared across all StudioHub domains.

Identity integrates with the Core framework while remaining independent from business-specific modules such as Organization and Production.

---

# Responsibilities

The Identity module provides:

- User Management
- Authentication
- Authorization
- Roles
- Permissions
- JWT Tokens
- Multi-Factor Authentication (MFA)
- Trusted Devices
- Backup Codes
- Sessions
- Security Events

---

# Directory Structure

```text
apps/identity/

├── api/
├── authentication/
├── choices/
├── constants/
├── events/
├── exceptions/
├── managers/
├── middleware/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── validators/
└── utils/
```

---

# Core Models

The Identity module includes models such as:

- User
- Role
- Permission
- UserRole
- UserPermission
- UserMFA
- TrustedDevice
- BackupCode
- LoginSession

Each model inherits the common enterprise models from the Core framework.

---

# Authentication

Supported authentication mechanisms:

- Email and Password
- JWT Access Tokens
- Refresh Tokens
- Token Rotation
- Password Reset
- Session Validation

---

# Authorization

Authorization is role and permission based.

Permission hierarchy:

```text
Module
   │
Category
   │
Action
```

Example:

- Production → Project → Create
- Organization → Department → Update
- Identity → User → Delete

---

# Multi-Factor Authentication

Security features include:

- TOTP Authentication
- Backup Codes
- Trusted Devices
- MFA Enrollment
- MFA Verification

---

# Services

Business services include:

- UserService
- AuthenticationService
- RoleService
- PermissionService
- MFAService
- TrustedDeviceService

Services coordinate workflows, validation, and event publishing.

---

# Selectors

Selectors provide optimized read operations for:

- Users
- Roles
- Permissions
- Sessions
- MFA
- Trusted Devices

---

# Validators

Validators enforce rules such as:

- Unique email addresses
- Password policy
- Role assignment
- Permission validation
- MFA enrollment rules

---

# Security Events

Typical domain events include:

- UserCreated
- UserUpdated
- LoginSucceeded
- LoginFailed
- PasswordChanged
- MFAEnabled
- TrustedDeviceAdded

---

# API Layer

The Identity API exposes endpoints for:

- Authentication
- User management
- Role management
- Permission management
- Password reset
- MFA configuration
- Session management

---

# Best Practices

- Authenticate every protected request.
- Enforce least-privilege permissions.
- Enable MFA for privileged users.
- Never expose sensitive information in API responses.
- Publish security-related events for auditing.

---

# Related Documents

- core.md
- ../02-architecture/api-architecture.md
- ../02-architecture/event-system.md
- ../02-architecture/service-layer.md
