Skills — Taxonomy & Management

Purpose

Define skill taxonomy and lifecycle for skill entries and proficiency tracking.

Skill entity

- skill_id UUID
- name
- category (e.g., DCC, Pipeline, Discipline)
- description
- active_flag
- metadata JSONB

Proficiency mapping (see proficiency.md)

- link skills to resource via SkillProficiency records: {skill_id, resource_id, level, years, verified_by, source}

Guidance

- Keep skill taxonomy configurable by organization; provide import/export.
- Avoid overly granular skills initially; start with a pragmatic VFX/animation skill set (DCCs, disciplines, specialized tools).

Next steps

- Create a starter taxonomy JSON for common VFX/Animation skills (nuke, houdini, maya, rendering, compositing).