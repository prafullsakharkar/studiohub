# StudioHub Permissions & Role-Based Access Control (RBAC)

## RBAC Matrix

StudioHub enforces a multi-layer authorization system:

### 1. System Roles (`User.system_role`)
- `SUPER_ADMIN`: Studio platform owner with global read/write across all tenants.
- `ORGANIZATION_ADMIN`: Full administrative control within their assigned organization.
- `CREW_MEMBER`: Standard studio artist or coordinator with project-scoped capabilities.
- `CLIENT_REVIEWER`: Restricted external portal user permitted only to review client playlists and sign off on deliveries.

### 2. Studio Roles (`User.role`)
- `SUPERVISOR`: Final creative authority on shot/asset approvals and Hero version promotions.
- `ADMIN`: Studio operations manager configuring departments, offices, billing, and storage.
- `LEAD`: Team lead assigning tasks and reviewing artist submissions.
- `ARTIST`: Individual contributor creating versions, submitting timelogs, and executing tasks.
- `COORDINATOR`: Production scheduling, delivery packaging, and client dispatch.
- `PRODUCER`: Budget tracking and vendor contract management.
- `CLIENT`: External client reviewer.

---

## DRF Permission Classes

- `IsTenantMember`: Ensures user belongs to the active tenant in `request.organization`.
- `IsSupervisorOrAdmin`: Restricts approval and promotion actions to supervisors or admins.
- `IsCrewMember`: Allows active studio crew members access to production tasks and review sessions.
