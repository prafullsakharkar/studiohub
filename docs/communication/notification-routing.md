Notification Routing — Algorithm & Pseudocode

Purpose

Defines the canonical routing algorithm used to create notifications from domain events: how recipients are resolved, permissions applied, preferences consulted, deduplication performed, and notifications enqueued for delivery.

High-level flow

1. Domain emits an Event (domain event) with stable event_id and event_name.
2. Event Processor (subscribes to event stream or outbox forwarder) receives the event and invokes Notification Router.
3. Notification Router consults mapping rules to decide whether to create logical Notification(s) and which templates to apply.
4. Recipient Resolution: Router resolves candidate recipients (actor, assignee, owner, watchers, explicit list, team members, role members).
5. Authorization Filter: remove recipients without permission to see the referenced entity at delivery time.
6. Preferences Filter: for each candidate recipient, apply preference precedence (SystemDefault < OrganizationPolicy < ProjectPolicy < UserPreference). If mandatory, cannot be disabled.
7. Deduplication & Grouping: compute dedupe_key and grouping_key to avoid duplicates and enable grouped inbox entries.
8. Persist Notification and NotificationRecipient rows atomically.
9. Enqueue per-channel delivery jobs (Celery tasks) with idempotency keys.
10. Delivery workers perform deliveries, record attempts in notification_deliveries, and update recipient delivery_status.

Recipient resolution rules (priority order)

- Explicit recipients: recipients included directly by the domain event (e.g., assigned_user_id).
- Actor-related: actor, creator, initiator — usually excluded from sending self-notifications unless user preference allows.
- Role/Team resolution: resolve team -> member list, filter by project/organization membership.
- Watchers & Followers: aggregate watchlist for the referenced entity.
- Derived recipients: dynamic (e.g., "notify shot lead" resolves at delivery time).

Permission & visibility checks

- For each candidate recipient, before creating a recipient entry, verify the recipient currently has permission to READ the entity referenced (project/shot/version). If permission revoked at delivery time, skip actual delivery and mark as 'undeliverable'.
- For external recipients (guest/client), apply stricter visibility rules and restrict content.

Preferences precedence (algorithm)

1. Start with System defaults for event_name (from notification templates / config).
2. Apply Organization policy override (cannot disable mandatory event types).
3. Apply Project policy override (if defined and allowed by org policy).
4. Apply User preference override.

Pseudocode (simplified)

function handle_event(event):
  mapping = lookup_event_mapping(event.event_name)
  if mapping is None: return

  logical_notifications = mapping.build_notification_models(event)

  for n in logical_notifications:
    candidates = resolve_recipients(n, event)
    # remove duplicates at candidate level
    candidates = unique(candidates)

    for recipient in candidates:
      if recipient.user_id == event.actor_id and should_suppress_self_notifications(recipient, n):
        continue

      if not has_permission(recipient.user_id, n.entity_ref):
        continue

      pref = resolve_preference(recipient.user_id, n.event_name, n.project_id)
      if pref.disabled and not n.mandatory:
        continue

      dedupe_key = compute_dedupe_key(event, n, recipient)
      existing = find_notification_by_dedupe(dedupe_key, recipient.user_id)
      if existing:
        # optionally merge grouping info, update metadata
        update_grouping(existing, n)
      else:
        tx.begin()
        notification_id = insert_notification(n, dedupe_key)
        recipient_row_id = insert_notification_recipient(notification_id, recipient, pref.channels)
        tx.commit()

        # schedule deliveries per channel
        for channel in pref.channels:
          schedule_delivery_job(notification_id, recipient_row_id, channel)

Idempotency & deduplication

- compute_dedupe_key should be deterministic and collision-resistant, e.g.:
  dedupe_key = sha256(str(event.event_id) + '|' + recipient_user_id + '|' + notification_type)
- Store dedupe_key on notifications and enforce unique index when appropriate (or check at insertion time).
- Delivery tasks must include (notification_id, recipient_id, channel, attempt_id) and be idempotent; ignore duplicate delivery tasks for same attempt id.

Grouping & summary notifications

- Use grouping_key derived from entity reference and event category, e.g. "version:v023" or "shot:SH010_020:comments"
- For high-frequency events (comments), route into grouped notifications using a time window (e.g. 30m) and update existing grouped notification rather than create new rows.

Examples: mapping a few domain events

Event: TaskAssigned { event_id, task_id, assigned_user_id, actor_id }
- Mapping: create Notification title "You were assigned TASK-123" for assigned_user_id
- dedupe_key: event_id + assigned_user_id
- channels: inapp + email (default), apply user preference

Event: CommentCreated { event_id, entity_type: 'version', entity_id, author_id, text }
- Mapping: notify watchers of the version/shot, mention targets (if any) get explicit notification with higher priority
- grouping_key: "version:{{entity_id}}:comments"
- grouping window: 30 minutes

Actionable considerations for implementers

- Revalidate permissions at delivery time: when user opens a notification, verify access to the target; if access revoked, display a safe message.
- Self-notifications: by default, suppress notifications to actor unless explicitly requested by user's preference.
- Respect mandatory events: security and operational alerts may be force-delivered regardless of user preferences (documented list).
- Provide admin endpoints to inspect DLQ, failed deliveries and to re-run deliveries with authorization.

API contracts (examples)

GET /notifications?recipient_id={user_uuid}&unread=true
- returns paginated list of Notification + NotificationRecipient objects

POST /notifications/{id}/read
- marks notification_recipients.read_at for current user

POST /notification-preferences
- create/update preference record for user

Operational notes

- Use separate queues for high-priority, email, webhook, and digest processing.
- Use correlation_id propagation: event_id -> notification_id -> delivery_id for tracing.
- Collect metrics: notifications.created, deliveries.attempted, deliveries.succeeded, deliveries.failed, queue_depth.

Security

- When rendering templates for external recipients, redact or omit sensitive metadata.
- Emails and push notifications must not expose secret URLs; provide deep links that require authentication or signed short-lived tokens.

