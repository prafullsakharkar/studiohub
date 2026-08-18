People — Canonical Person model

Purpose

Define the canonical Person aggregate used across Workforce and Production.

Key fields (recommended)

- id UUID
- organization_id UUID
- legal_name
- preferred_name
- emails [primary, secondary]
- phones
- time_zone
- locale
- profile_photo_ref
- public_profile (bool)
- contact_preferences (links to docs/communication/preferences.md)
- metadata JSONB (non-sensitive profile data)

Ownership & synchronization

- Identity service owns login credentials and username/email authenticity.
- HR/Payroll owns employment-specific fields; StudioHub may read from HR via adapter and mark fields as HR-owned.

Privacy

- Personal contact data should be protected; use scoped serializers for public search and internal detailed views.

Use cases

- Display in UI: production assignments, review responsibilities, notifications
- Search: people by name, skills, project history
- Integration: onboarding flows (invite user, create person record, link to employee/contractor record)

Next steps

- Map existing backend models (User, Profile) to canonical Person and identify duplication.