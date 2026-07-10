# Organization Module

## Overview

The Organization module models the studio hierarchy used throughout StudioHub. It manages organizations, departments, offices, teams, memberships, positions, calendars, and related business rules.

It provides the organizational context required by the Production module while relying on the Core and Identity modules for shared infrastructure and user management.

---

# Responsibilities

- Organizations
- Departments
- Offices
- Teams
- Positions
- Memberships
- Invitations
- Branding
- Work Calendars
- Holidays
- Organization Settings

---

# Directory Structure

```text
apps/organization/
├── api/
├── choices/
├── constants/
├── events/
├── managers/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── validators/
└── utils/
```

---

# Core Entities

- Organization
- Department
- Office
- Team
- Position
- OrganizationMembership
- Invitation
- Branding
- OrganizationSettings
- WorkCalendar
- Holiday
- WorkHours

All entities inherit the Core base models for UUIDs, timestamps, auditing, metadata, and soft deletion.

---

# Business Rules

- Department codes are unique within an organization.
- Teams belong to exactly one organization.
- Offices belong to an organization.
- Memberships link users to organizations and roles.
- Archived entities cannot accept new relationships.
- Soft-deleted records are excluded from normal queries.

---

# Services

Key services include:

- OrganizationService
- DepartmentService
- OfficeService
- TeamService
- MembershipService
- InvitationService

Services coordinate validation, transactions, and event publication.

---

# Selectors

Selectors provide optimized read operations for:

- Organization hierarchy
- Department trees
- Team membership
- Office lookups
- Organization dashboards

---

# Validators

Validators enforce:

- Unique codes and names
- Membership constraints
- Invitation validity
- Organization ownership
- Status transitions

---

# Events

Typical domain events:

- OrganizationCreated
- DepartmentCreated
- DepartmentArchived
- TeamCreated
- MemberInvited
- MembershipAdded

Subscribers handle auditing, notifications, cache invalidation, and analytics.

---

# API Layer

The Organization API exposes endpoints for:

- Organizations
- Departments
- Offices
- Teams
- Memberships
- Invitations
- Settings

Filtering, pagination, searching, and ordering are supported consistently.

---

# Integration

The Production module references organizations to scope projects, resources, and permissions. Identity provides users and authentication; Core provides shared infrastructure.

---

# Best Practices

- Scope all data by organization.
- Use services for write operations.
- Use selectors for read operations.
- Keep cross-domain dependencies one-way.
- Publish events for significant organizational changes.

---

# Related Documents

- core.md
- identity.md
- ../02-architecture/ddd.md
- ../02-architecture/service-layer.md
