Reminders & Escalations

Overview

Covers task due reminders, review reminders, overdue escalations and safe policies to avoid notification storms.

Reminders

- Use scheduled scans or delayed tasks to detect due-soon / overdue items and generate reminder events.
- Avoid creating millions of scheduled jobs; prefer periodic scans that enqueue reminders for affected recipients.

Escalations

- Escalation policy example:
  - After X hours: notify assignee
  - After Y additional hours: notify team lead
  - After Z additional hours: notify production manager

Safety and cooldowns

- Deduplicate escalations per entity using dedupe keys.
- Apply maximum escalation counts and stop conditions (e.g., when the status changes).
- Respect user quiet hours and organization policy unless mandatory.

Operational notes

- Provide admin tooling to simulate escalation policies and view escalation history.
