Real‑Time — WebSocket / SSE strategy & fallbacks

Overview

Documents strategy for real‑time fanout of notifications and activity updates. Real‑time is an optimization for immediacy — persistent inbox must remain authoritative.

Transport choices

- WebSockets (preferred for full-duplex interactions) or Server‑Sent Events (SSE) for uni-directional updates.
- Backend dependency: websockets library is present in backend lockfile; architecture supports configurable real-time adapters.

Auth & channel model

- Connections must authenticate and be authorized for organization/project scope.
- Channel examples: user:{user_id}, project:{project_id}, review:{review_id}

Behavior

- On NotificationRecipient creation: publish real‑time event to user channel with notification summary.
- If client disconnected: rely on persistent inbox; client fetches missed notifications via GET /notifications.

Scaling

- Use Redis pub/sub or dedicated real-time router for fanout. Avoid using Redis as the source of truth.

Security

- Ensure connections are scoped to user identity. Do not broadcast sensitive events to global channels.

Fallbacks

- If real-time delivery fails, ensure inbox unread counts and list are consistent.

