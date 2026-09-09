Resource — Abstraction & Types

Purpose

Define the Resource abstraction: schedulable entities that can be allocated and assigned.

Resource types

- Human (linked to Person)
- Team / Resource Pool
- Facility (review room, mocap stage)
- Machine (render node, workstation)
- RenderPool / ComputeCluster

Recommended fields

- id UUID
- organization_id UUID
- resource_type (enum)
- display_name
- linked_person_id UUID nullable
- linked_vendor_id UUID nullable
- department_id UUID nullable
- timezone
- capacity_profile_id (link to working hours/calendar)
- metadata JSONB

Behavioral notes

- Use Resource as the primary reference in allocations and capacity calculations. Assignments (task assignee) may reference resource_id.
- A Resource can have multiple member Persons (e.g., a Team) and a Person may map to multiple Resource rows (e.g., Person + Dedicated Render Wrangler resource)

Next steps

- Create API contract snippets for /resources and /resources/{id} and map to existing models.