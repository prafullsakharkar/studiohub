Delivery — Channel adapters, queues & worker topology

Overview

Defines how logical notifications are translated into per-channel delivery attempts and the recommended background processing topology.

Channel adapters

- Keep adapters small and idempotent. Example adapters:
  - InAppAdapter: persist delivered_channels and publish realtime event
  - EmailAdapter: call EmailProvider.send_email
  - WebhookAdapter: POST JSON to endpoint with signing
  - PushAdapter: call PushProvider

Queue topology

- Recommended queues:
  - high_priority
  - email
  - webhook
  - push
  - digest
  - retries (optional centralized)

Worker topology

- Dedicated workers per queue type with auto-scaling based on queue depth.
- Use Celery for background tasks (project already includes celery + redis). Use separate concurrency and prefetch settings per worker type.

Delivery job flow (per attempt)

1. Fetch notification_id, recipient_id, channel
2. Build provider payload (render template if needed)
3. Call adapter API
4. Record notification_deliveries attempt and status
5. On success: mark delivered_channels for recipient
6. On failure: schedule retry with exponential backoff; escalate to DLQ after max attempts

Monitoring & alerts

- Track per-queue depth and delivery failure rate.
- Alert on sustained delivery failures or DLQ growth.

