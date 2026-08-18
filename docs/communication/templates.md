Notification Templates — Model & Security

Purpose

Defines how notification templates are authored, versioned, previewed and secured. Templates back every channel that requires formatted content (email, push, webhook payloads, in-app rich text).

Key rules

- Templates store only safe templating source (e.g., Jinja2 with disabled extensions or a sandboxed renderer).
- Template variables must be whitelisted per event and documented in variables JSON.
- Templates are versioned; a change increments version and retains prior versions for auditing.
- Admins can preview templates using sanitized sample data.

Template fields

- name, organization_id, event_name, channel, subject_template, body_template, variables, locale, version, enabled

Security

- No arbitrary code execution allowed in templates.
- Limit context to primitives and small, safe structures (ids, names, codes, small metadata). Do not expose full domain objects.
- Strip HTML when sending push/browser notifications or provide sanitized versions.

Previewing

- Provide an endpoint that returns rendered subject/body for a sample payload.
- Redact personally identifying or confidential fields in previews where appropriate.

