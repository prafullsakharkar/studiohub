Notification Preferences — Model & API

Overview

Defines how users control which notifications they receive and by which channels/frequency. Preferences follow a precedence hierarchy: System Default < Organization Policy < Project Policy < User Preference.

Schema sketch (already present in notification-model.md)
- notification_preferences table: (id, organization_id, user_id, event_name, channels, mandatory, scope, updated_at)

UI & API guidance

- Preference UI should present event categories with toggles for In-App / Email / Push / Digest and a frequency selector.
- Provide a preview button that shows how the notification would look for the user (sanitized sample data).

API examples

GET /notification-preferences?user_id=...
PATCH /notification-preferences/{id}

Precedence algorithm (repeated)

1. System defaults (from templates/config)
2. Organization-level policy (enforced by admin; may be mandatory)
3. Project-level policy (optional override)
4. User override

Mandatory events (examples)
- security.*
- system.alerts.*

