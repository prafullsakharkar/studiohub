Proficiency — Levels & Verification

Purpose

Define proficiency levels, verification sources and expiration semantics.

Recommended levels (configurable)

- 1 — Beginner
- 2 — Intermediate
- 3 — Advanced
- 4 — Expert

Proficiency record

- id UUID
- resource_id
- skill_id
- level (enum/int)
- years_experience
- verified_by (resource_id or user)
- verified_at
- source (self_reported|manager_verified|assessment|certification)
- valid_from, valid_to

Guidance

- Verification source must be recorded to avoid treating self-reported skills as equivalent to assessed skills.
- Support expiry for time-bound certifications.

Next steps

- Map existing tests or HR certifications to this model.