# StudioHub Audit Logging Architecture

## Audit System Overview
The `apps.audit` app maintains an immutable audit log of all critical production mutations, approvals, logins, and permission changes.

---

## Logged Events
- **Entity Creation / Soft Deletion**: Shots, Assets, Tasks, Projects, Versions.
- **Workflow Approvals**: Shot approvals, Timelog sign-offs, Review session verdicts, Delivery hand-offs.
- **Security & Access**: User logins, token blacklists, permission updates.

---

## Data Schema (`AuditLogEntry`)
- `user_name`: Name of the acting user.
- `user_email`: Email of the acting user.
- `action`: Action verb (`CREATED`, `UPDATED`, `APPROVED`, `REJECTED`, `PROMOTED`, `DELETED`).
- `entity_type`: Target entity class (`Shot`, `Asset`, `Task`, `Review`, `Version`, `Delivery`).
- `entity_id`: UUID of the modified object.
- `entity_code`: Human-readable identifier.
- `details`: JSON or text representation of changed fields.
- `ip_address`: Client IP address.
