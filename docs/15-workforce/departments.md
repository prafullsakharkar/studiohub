Departments & Organization Hierarchy

Purpose

Define Department as the organizational grouping primarily used for reporting, cost centers and capacity rollups.

Recommended fields

- department_id UUID
- organization_id UUID
- name
- parent_department_id (nullable)
- manager_resource_id
- metadata JSONB

Notes

- Departments are administrative constructs and may map to cost centers in Commercial (Part 11).
- Teams operate within Departments; resource membership may be cross-departmental for project work.

Next steps

- Map to existing organization/department models in the repo and confirm owner.