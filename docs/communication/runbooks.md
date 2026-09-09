Runbooks — Operational procedures

Includes runbooks for: email provider outage, webhook outage, DLQ recovery, queue backlog, and notification storm mitigation.

Example: DLQ recovery

1. Inspect DLQ entries and classify error types.
2. If provider outage: notify stakeholders and consider failover if configured.
3. For transient malformed payloads: fix payload generator and requeue selected DLQ items.
4. For permanent failures: mark deliveries failed and notify owners.

Example: Notification storm mitigation

- Enable grouping for high-frequency events (comments)
- Apply temporary suppression rules for bulk imports or automated scripts
- Notify admins and provide a temporary throttle switch

