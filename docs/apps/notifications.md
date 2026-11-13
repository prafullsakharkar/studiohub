# Application: notifications

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in `docs/review-pipeline/`
(`PLAN.md` "RP-6 Notifications (in-app)", `CONTRACTS.md` C-RP-23 to C-RP-25, `DECISIONS.md` Q-RP-32 to Q-RP-40) and
the report `docs/review-pipeline/rp-6-verification.md`.

## 2. Application information

```text
Application: notifications  (apps/notifications)
Domain:      A person's in-app inbox
Purpose:     Tell people, inside StudioHub, about notes, mentions, replies, assignments, status changes and review movies
Dependencies: core (event bus, base views, pagination), identity (users), production (events, and reads through
              apps/production/selectors/notification_sources.py only)
Status:      Built on feature/rp-6-notifications (review-pipeline RP-6)
```

## 3. Domain responsibility

**Owns:** `Notification` rows (`notifications_notification`): recipient, kind, actor, project, target (`note`, `task`
or `version` and its id), `data` (status names and an error code only, never text a person typed), `created_at`,
`read_at`.

**Does not own:** the records a row points at, their labels or who may open them. Labels (codes, names, the
thread's subject) are read from the live records when the inbox answers. Reach is the target's own `GET` rule,
answered by production's selectors.

Nothing else imports this app (`apps/core/tests/test_dependency_direction.py`); it reads production through
`notification_sources.py` only.

## 4. How it works

- **Writing.** Handlers in `events/handlers.py` subscribe to production's events (`NoteCreated`, `NoteReplied`,
  `NoteStatusChanged`, `NoteMentioned`, `TaskAssigned`, `StatusChanged` for tasks and versions, `ReviewMediaFinished`).
  They run after the action commits. `FanoutService.notify` drops the actor, keeps active users who can open the target,
  merges kinds (`note_mention` wins) and writes the rows in one `bulk_create`. Each handler logs
  `notification_fanout_failed` and swallows its own errors, so a failure never changes the action's answer.
- **Reading.** `InboxSelector.visible` answers the caller's own rows whose target is still in their reach, as one
  subquery per target type, so paging and the unread count come after the check. The routes (C-RP-23):

  | Route | Answer |
  |---|---|
  | `GET /api/v1/notifications/` | newest first, paginated; filters `unread`, `project_id`, `kind` (an unknown value gives none) |
  | `GET /api/v1/notifications/unread-count/` | `{count}` |
  | `POST /api/v1/notifications/{id}/read/`, `…/unread/` | the row; another person's id is 404 |
  | `POST /api/v1/notifications/read-all/` | `{updated}`; an optional `before` leaves newer rows unread |

  Any signed-in user may call them; there is no permission code.
- **Retention.** Celery beat runs `notifications.purge` daily at 04:10 and deletes rows older than
  `NOTIFICATIONS_RETENTION_DAYS` (default 90), in batches.
- **Admin.** Read-only `NotificationAdmin`.

## 5. Frontend

- The header bell (`frontend/src/modules/notifications/NotificationBell.tsx`) polls the unread count every minute
  while the tab is visible and loads the newest 20 rows when opened. The page `/notifications` lists them all.
- A row opens its record (a task or version page, the version's Media tab for a review movie, or the Notes tab of the
  record a note is about) and marks itself read.
- The notes board and form take mentions through `MentionPicker` (`mention_ids`, at most 20).
- Typed API: `frontend/src/api/notifications/`. Sample: `docs/sync/samples/notifications/_notifications_flow.json`
  (capture tool `docs/sync/tools/test_capture_notifications.py`).

## 6. Tests

`apps/notifications/tests/test_rp6_notifications.py`: recipients per event, reach when writing and reading, mentions,
the inbox routes, retention, and fan-out failures.
