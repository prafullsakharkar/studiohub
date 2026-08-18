# Notifications — Preferences, Reminders & Escalation

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Describes review-related notification flows: mention notifications, review requests, reminders, escalation, and user preferences.

Notification types
------------------
- Immediate: mentions, direct replies, approval requests
- Reminders: due-date reminders, overdue escalations
- Digest: daily/weekly summaries

Preferences
-----------
- Per-user settings: in-app, email, push, frequency (immediate, hourly, daily, off)
- Per-project or organization overrides where required by policy

Escalation
----------
- Configurable escalation rules for overdue reviews (notify lead, producer)
- Escalation actions should be auditable and idempotent

APIs & events
-------------
- NotificationSent, NotificationFailed, NotificationRead

Testing
-------
- Test mention routing, preference enforcement, and escalation triggers

End of notifications doc.
