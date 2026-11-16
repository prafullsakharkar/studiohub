# Application: notifications

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in `docs/review-pipeline/`
(`PLAN.md` "RP-6 Notifications (in-app)" and "RP-11 Notification depth", `CONTRACTS.md` C-RP-23 to C-RP-25 and
C-RP-28 to C-RP-30, `DECISIONS.md` Q-RP-32 to Q-RP-40 and Q-RP-46 to Q-RP-50) and the reports
`docs/review-pipeline/rp-6-verification.md` and `rp-11-verification.md`.

## 2. Application information

```text
Application: notifications  (apps/notifications)
Domain:      A person's in-app inbox
Purpose:     Tell people, inside StudioHub, about notes, mentions, replies, assignments, status changes, review movies,
             review decisions, verdicts and review comments; let each person mute the kinds they do not want
Dependencies: core (event bus, base views, pagination), identity (users), production (events, and reads through
              apps/production/selectors/notification_sources.py only)
Status:      RP-6 released in 4.7.0; RP-11 (reviews and preferences) built on feature/rp-11-notification-depth
```

## 3. Domain responsibility

**Owns:** `Notification` rows (`notifications_notification`): recipient, kind, actor, project, target (`note`, `task`,
`version` or `review` and its id), `data` (status names, a verdict, a version id and an error code only, never text a
person typed), `created_at`, `read_at`. `NotificationPreference` (`notifications_preference`, one row per person who
saved): the kinds they muted.

**Does not own:** the records a row points at, their labels or who may open them. Labels (codes, names, the
thread's subject) are read from the live records when the inbox answers. Reach is the target's own `GET` rule,
answered by production's selectors.

Nothing else imports this app (`apps/core/tests/test_dependency_direction.py`); it reads production through
`notification_sources.py` only.

## 4. How it works

- **Writing.** Handlers in `events/handlers.py` subscribe to production's events (`NoteCreated`, `NoteReplied`,
  `NoteStatusChanged`, `NoteMentioned`, `TaskAssigned`, `StatusChanged` for tasks, versions and reviews,
  `ReviewMediaFinished`, and from RP-11 `ReviewDecided`, `ReviewParticipantAdded`, `ReviewParticipantVerdict`,
  `ReviewCommentAdded` from `apps/production/events/reviews.py`). They run after the action commits.
  `FanoutService.notify` drops the actor, drops each (person, kind) the person muted, keeps active users who can open
  the target, merges kinds (`note_mention` wins) and writes the rows in one `bulk_create`.
- **Review recipients (RP-11, C-RP-28).** A decision (`review_decision`): the people whose work the review's versions
  are and its participants. Being added as a participant: that person (`review_invited`). A participant's verdict
  other than `Pending Review`: the lead reviewer and the creator (`review_verdict`). A comment on a version
  (`review_comment`): the people whose work that version is; a reply also tells the thread's author and the earlier
  repliers. "Whose work a version is" means its `artist` and the assignee of its task (`_version_people` in
  `notification_sources.py`), as for `version_status`: a version made on the Versions screen names no artist. A
  comment that is not client-visible is told to no client member (C-RP-29). Each handler logs
  `notification_fanout_failed` and swallows its own errors, so a failure never changes the action's answer.
- **Reading.** `InboxSelector.visible` answers the caller's own rows whose target is still in their reach, as one
  subquery per target type, so paging and the unread count come after the check. The routes (C-RP-23):

  | Route | Answer |
  |---|---|
  | `GET /api/v1/notifications/` | newest first, paginated; filters `unread`, `project_id`, `kind` (an unknown value gives none) |
  | `GET /api/v1/notifications/unread-count/` | `{count}` |
  | `POST /api/v1/notifications/{id}/read/`, `…/unread/` | the row; another person's id is 404 |
  | `POST /api/v1/notifications/read-all/` | `{updated}`; an optional `before` leaves newer rows unread |
  | `GET`/`PUT /api/v1/notifications/preferences/` | `{muted_kinds, mutable_kinds}`; `PUT` replaces `muted_kinds`, 400 on an unknown kind or one that cannot be muted (`note_mention`, `review_invited`) (C-RP-30) |

  Any signed-in user may call them; there is no permission code.
- **Retention.** Celery beat runs `notifications.purge` daily at 04:10 and deletes rows older than
  `NOTIFICATIONS_RETENTION_DAYS` (default 90), in batches.
- **Admin.** Read-only `NotificationAdmin`.

## 5. Frontend

- The header bell (`frontend/src/modules/notifications/NotificationBell.tsx`) polls the unread count every minute
  while the tab is visible and loads the newest 20 rows when opened. The page `/notifications` lists them all.
- A row opens its record (a task or version page, the version's Media tab for a review movie, a review's page, or the
  Notes tab of the record a note is about) and marks itself read.
- The page's "What to tell me" panel (`NotificationPreferencesPanel.tsx`) has one switch per kind that can be muted;
  each change saves at once.
- The notes board and form take mentions through `MentionPicker` (`mention_ids`, at most 20).
- Typed API: `frontend/src/api/notifications/`. Samples: `docs/sync/samples/notifications/_notifications_flow.json`
  and `_review_notifications_flow.json` (capture tools `docs/sync/tools/test_capture_notifications.py` and
  `test_capture_review_notifications.py`). Live: `frontend/src/test/live/notifications.live.test.tsx` and
  `reviewNotifications.live.test.tsx`.

## 6. Tests

`apps/notifications/tests/test_rp6_notifications.py`: recipients per event, reach when writing and reading, mentions,
the inbox routes, retention, and fan-out failures. `test_rp11_review_notifications.py`: client-visible comments
(C-RP-29), review recipients (C-RP-28), review rows in the inbox, and preferences (C-RP-30).
