Notification Model — DB & JSON Schemas

Purpose

This document defines canonical data models and JSON event schemas for StudioHub notifications and related artifacts. Use these schemas as the single source of truth for implementation, API contracts, and tests.

Design notes

- Multi‑tenant: all notification records are scoped by organization_id and optionally project_id.
- Read state is per‑recipient: a single notification may have multiple NotificationRecipient rows (one per recipient) capturing read/archive/actioned state.
- Use UUIDs for primary identifiers.
- Avoid embedding large domain objects — reference by (entity_type, entity_id).

Database schema (conceptual)

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id UUID, -- nullable when org-level
  event_name TEXT NOT NULL, -- e.g. "version.approved.v1"
  event_id UUID, -- original domain event id for traceability
  title TEXT NOT NULL,
  body TEXT, -- short plaintext or markdown summary
  action_url TEXT, -- deep link to UI (relative path preferred)
  metadata JSONB, -- small JSON with structured fields (not large blobs)
  grouping_key TEXT, -- optional for grouping (e.g., "version:v023")
  dedupe_key TEXT, -- deterministic key for idempotency
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- optional expiration
  priority INTEGER DEFAULT 20,
  severity TEXT DEFAULT 'normal'
);

-- Notification recipients (per-user state)
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL,
  recipient_email TEXT, -- optional snapshot
  channel_list TEXT[], -- channels this recipient should receive (e.g. ['inapp','email'])
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  actioned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_channels JSONB DEFAULT '{}', -- map channel->delivered_at
  delivery_status TEXT DEFAULT 'queued' -- queued | processing | delivered | failed
);

-- Notification deliveries (per-channel attempts, for audit)
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES notification_recipients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- inapp|email|webhook|push
  provider TEXT, -- e.g. 'smtp', 'sendgrid', 'webhook', 'browserpush'
  attempt INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending | success | failed | dead_letter
  last_error TEXT,
  payload JSONB, -- provider payload (avoid storing secrets)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY,
  organization_id UUID,
  name TEXT NOT NULL,
  event_name TEXT, -- associated event or empty for arbitrary use
  channel TEXT NOT NULL, -- inapp|email|push|webhook
  subject_template TEXT, -- for email/push
  body_template TEXT, -- template source (must be sandboxed)
  variables JSONB, -- documented allowed variables
  locale TEXT DEFAULT 'en',
  version INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification preferences (per-user)
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  organization_id UUID,
  user_id UUID NOT NULL,
  event_name TEXT NOT NULL, -- or '*' for category
  channels JSONB, -- map channel -> settings: {enabled: bool, frequency: immediate|hourly|daily|digest}
  mandatory BOOLEAN DEFAULT false, -- cannot be overridden if true
  scope JSONB, -- optional scoping (project_id, team_id)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

Indexes (suggested)

- notifications(organization_id, created_at)
- notification_recipients(recipient_user_id, delivery_status, read_at)
- notification_recipients(notification_id)
- notification_deliveries(notification_id, status)
- notifications(dedupe_key)

JSON Schemas (canonical for events / API payloads)

1) Notification JSON (persistent object returned by API)

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Notification",
  "type": "object",
  "properties": {
    "id": {"type": "string", "format": "uuid"},
    "organization_id": {"type": "string", "format": "uuid"},
    "project_id": {"type": ["string","null"], "format": "uuid"},
    "event_name": {"type": "string"},
    "event_id": {"type": ["string","null"], "format": "uuid"},
    "title": {"type": "string"},
    "body": {"type": ["string","null"]},
    "action_url": {"type": ["string","null"]},
    "metadata": {"type": ["object","null"]},
    "grouping_key": {"type": ["string","null"]},
    "dedupe_key": {"type": ["string","null"]},
    "created_at": {"type": "string", "format": "date-time"},
    "priority": {"type": "integer"},
    "severity": {"type": "string"}
  },
  "required": ["id","organization_id","event_name","title","created_at"]
}

2) NotificationRecipient JSON (per-user state)

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NotificationRecipient",
  "type": "object",
  "properties": {
    "id": {"type": "string", "format": "uuid"},
    "notification_id": {"type": "string", "format": "uuid"},
    "recipient_user_id": {"type": "string", "format": "uuid"},
    "channels": {"type":"array","items":{"type":"string"}},
    "read_at": {"type":["string","null"],"format":"date-time"},
    "archived_at": {"type":["string","null"],"format":"date-time"}
  },
  "required": ["id","notification_id","recipient_user_id"]
}

Notification template variable policy (summary)

- Templates may access only whitelisted context variables. Example whitelist for review events:
  - user: {id, name}
  - project: {id, name}
  - shot: {id, code}
  - version: {id, number}
- Template rendering must be sandboxed; no arbitrary code execution.
- Preview endpoints must render templates against sanitized sample payloads and redact sensitive fields.

Operational notes

- Use dedupe_key for idempotency: usually (event_id + recipient_user_id + notification_type) or generated deterministic key when event_id absent.
- Recipient snapshot: store email or display name on NotificationRecipient if required for external channels to preserve historical context.
- Revalidate permissions when user opens the notification (do not assume creation-time permissions still apply).

