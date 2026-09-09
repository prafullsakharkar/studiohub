Workforce Security & Permissions

Purpose

Document workforce-specific security, privacy and permission requirements.

Principles

- Least privilege: restrict sensitive workforce data (compensation, contact details, leave reasons) to authorized roles.
- Data segregation: respect organization tenancy and restrict cross-org queries.
- Audit: every sensitive change (assignment, allocation, leave approval) must be auditable.
- PII handling: apply data minimization in search results and public views.

Suggested permissions (examples)

- view:workforce
- manage:workforce
- manage:skills
- manage:calendars
- manage:availability
- approve:leave
- approve:allocations
- view:resource-costs (restricted to finance roles)

Next steps

- Map these permissions to existing permission model and add workforce-specific permissions as required.