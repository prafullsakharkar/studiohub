Retries & Dead Letter Queue

Overview

Defines retry/backoff policies, DLQ behavior and operational procedures for failed deliveries.

Retry policy

- Default: exponential backoff with jitter. Example: attempts: [30s, 2m, 10m, 60m, 4h]
- Max attempts configurable per channel/provider.
- Retry only on transient failures (network errors, 5xx, 429 with Retry-After). Treat most 4xx as permanent.

Dead Letter Queue (DLQ)

- After max attempts, move delivery to DLQ and record full failure context.
- Provide admin UI to inspect DLQ, re-run deliveries, or discard with audit.
- DLQ entries should include: delivery_id, notification_id, recipient_id, channel, last_error, attempt_count, first_attempt_at, last_attempt_at.

Operational runbook

- If DLQ grows: investigate provider availability, rate limiting, or malformed payloads.
- For webhook DLQ: attempt manual replays, but verify consumer readiness.
- For email DLQ: check bounce/suppression lists before re-running.
