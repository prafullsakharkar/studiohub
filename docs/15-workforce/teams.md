Teams & Resource Pools

Purpose

Guide for Team and ResourcePool constructs used for grouping resources for staffing and allocation.

Recommended fields

- team_id UUID
- name
- department_id
- members (resource_id list)
- lead_resource_id
- capacity_policy (rules for pooled allocation)
- metadata JSONB

Behavior

- Teams are used for soft allocations (reserve team-level capacity) and for expressing vendor teams where individual identity is not necessary.
- Teams should be queryable by skill composition and availability.

Next steps

- Define APIs for team membership, pool allocation and team-level capacity snapshots.