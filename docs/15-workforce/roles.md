Roles — Job Roles vs Project Roles

Purpose

Clarify Role vs Skill and project-role concepts.

Definitions

- Job Role: organizational/professional position (e.g., Senior Compositor, Pipeline TD). Stored as canonical role taxonomy.
- Project Role: assignment-level role for a person/resource on a specific project (e.g., Lead Compositor on Project X).

Recommended fields for JobRole

- role_id UUID
- name
- description
- default_skills (list)
- seniority_levels
- metadata JSONB

Guidance

- Do not hardcode roles in business logic. Allow organization-level customization.
- Project roles reference JobRole but include project-specific responsibilities.

Next steps

- Provide UI/fixtures for common VFX/Animation roles and allow import/configuration.