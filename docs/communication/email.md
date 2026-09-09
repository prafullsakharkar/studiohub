Email — Provider Abstraction & Runbook

Overview

Describes the email provider abstraction, template usage, retries, bounce handling and operational guidance.

Abstraction

- Implement EmailProvider interface with methods: send_email(to, subject, body, headers, attachments, metadata).
- Provider implementations: SMTP backend (for dev), transactional provider adapter (SendGrid, SES, Postmark).
- Do not let domain modules depend on provider-specific SDKs; keep providers behind an adapter.

Templates

- Use notification_templates table for subject/body; render server-side.
- Provide both HTML and plain-text alternatives.

Retries & bounces

- Use exponential backoff with jitter for transient failures (5 attempts default).
- For permanent failures (hard bounce), mark recipient as suppressed and record in suppression table.

Runbook (example)

- If email provider outage: pause email queue, switch to secondary provider (if configured), notify admins via Ops channel.
- If bounce rates spike: inspect suppression list and recent template changes, validate recipient addresses.

Security

- Validate recipients at delivery time.
- Avoid leaking production data in subject lines; use conservative subject content for external recipients.
