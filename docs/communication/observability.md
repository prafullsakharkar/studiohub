Observability — Metrics, Tracing & Logs for Communication

Metrics to collect

- notifications.created (by event_name, organization)
- notification_recipients.queued
- deliveries.attempted (by channel, provider)
- deliveries.succeeded
- deliveries.failed
- deliveries.dead_lettered
- queue_depth (per Celery queue)
- delivery_latency (histogram)

Tracing

- Propagate correlation identifiers: request_id -> event_id -> notification_id -> delivery_id
- Use distributed tracing to correlate domain events to delivery attempts.

Logging

- Log identifiers and error classifications, not full payloads. Mask or avoid logging sensitive fields.

Dashboards & Alerts

- Dashboards: delivery success rate, DLQ size, queue depth, per-provider failure rate
- Alerts: DLQ growth beyond threshold, provider error rate spike, queue depth sustained growth
