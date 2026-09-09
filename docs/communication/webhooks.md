Webhooks — Endpoint lifecycle, Security & Delivery

Purpose

Documents webhook endpoint management, signing, delivery attempts, retry/backoff, DLQ behavior and operational inspection.

Endpoint lifecycle

- Admins create webhook endpoints with: name, url, events (list), secret (rotatable), enabled, allowed_ips (optional), active flag.
- Provide: POST /webhooks, PATCH /webhooks/{id}, DELETE /webhooks/{id}, GET /webhooks/{id}/deliveries

Security

- Sign each payload with HMAC (SHA256) using the endpoint secret and include timestamp header.
- Include event_id and delivery_id in headers to support idempotency at consumer side.
- Reject requests older than configured window (e.g., 5 minutes) to limit replay attacks.

Delivery & retries

- Use background workers to perform HTTP delivery.
- On transient HTTP error (5xx, timeout), retry with exponential backoff and jitter.
- On 4xx (except 429), consider the error permanent and mark as failed (do not retry), but surface the error for manual inspection.
- After N attempts, move to Dead Letter Queue and create an admin alert.

Idempotency

- Include headers: X-StudioHub-Event-ID, X-StudioHub-Delivery-ID to allow idempotent consumer processing.

Delivery history

- Persist each attempt in webhook_deliveries (timestamp, status, http_status, response_snippet) with retention policy.

Rate limiting

- Provide per-endpoint rate limit configuration; backoff when consumer returns 429 with Retry-After.

Operational notes

- For critical integrations, allow a test delivery UI and a re-deliver action from the admin dashboard.
- Ensure secrets can be rotated without losing the ability to validate recent deliveries (support multiple active secrets during rotation window).
