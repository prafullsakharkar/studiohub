# RP-13 verification: notifications beyond reviews

Branch `feature/rp-13-notifications-beyond-reviews`, off `develop` at `987d6839` (v4.9.0). Planned, answered (Q-RP-57 to Q-RP-62 = A, "go ahead") and built on 2026-11-16. Contracts C-RP-34 to C-RP-36 ([CONTRACTS.md](CONTRACTS.md#rp-13-notifications-beyond-reviews)). Committed as `88a24c4b`, merged into `develop` (`1a87076f`, CI green) and `main` (`921bf738`, CI green), **released in v4.10.0**.

## What was built

| WP | Done |
|---|---|
| 13.1 Events | `DeliveryStatusChanged` (`deliveries/events/status.py`), published by `transitions.move`, the only status writer, for every move including the platform's; `client_status` says the move recorded the client's answer. `PublishJobFinished` (`publishing/events/files.py`), published by `JobService._step` when a job ends Exported or Failed. `MilestoneCompleted` (new `scheduling/events/`), published by `MilestoneService.complete`. `PublishedFileRevoked` is reused. All dispatched after commit. |
| 13.2 Reach and labels | `selectors/notification_sources.py` in deliveries, publishing and scheduling: the people of a record, `readable_query` (the record's own `GET`: its view code and its selector's project narrowing), labels. `apps/notifications/sources.py` looks each target type up in one registry; the fan-out and the inbox use it instead of production's four-way switch. A new dependency test keeps notifications off the three apps' models. |
| 13.3 Kinds and handlers | Kinds `delivery_status`, `delivery_client_answer`, `publish_finished`, `published_file_revoked`, `milestone_due`, `milestone_completed`; target types `delivery`, `publish_job`, `published_file`, `milestone`. Four handlers. The reminders: `services/reminders.py` and the task `notifications.milestone_reminders`, hourly at minute 20 in beat. Migration `notifications` `0003_rp13_more_kinds` (choices only). Every new kind can be muted. |
| 13.4 Frontend | Kinds, target types and `data` fields in `api/notifications/notifications.ts`; a sentence and a link per kind (`modules/notifications/describe.ts`): a delivery, a job and a file open their pages, a milestone its project's Schedule tab; a due date is read as that calendar day in any time zone. Six "What to tell me" labels. OpenAPI schema and `openapi.ts` regenerated (the kind enums). |
| 13.5 Capture and live | `docs/sync/tools/test_capture_pipeline_notifications.py` → `docs/sync/samples/notifications/_pipeline_notifications_flow.json`. Live: `frontend/src/test/live/pipelineNotifications.live.test.tsx`. |
| 13.6 Docs | CONTRACTS (C-RP-34 to C-RP-36 and the details settled while building), DECISIONS (answers, phase row), PLAN status, `docs/apps/notifications.md`, the pre-deploy checklist entry, this report. |

## For the owner: details settled while building

Each is written up in [CONTRACTS.md](CONTRACTS.md#rp-13-notifications-beyond-reviews), "Details settled while building RP-13":

1. **One delivery event, not two.** Recording the client's answer is itself a move, so it publishes the same `DeliveryStatusChanged` with `client_status`. It is told as `delivery_client_answer` only, never also as a `delivery_status`.
2. **"Whoever signed it off" survives a reopen.** A reopen clears `signed_off_by`, so the signer is also read from the history (the latest move into Signed Off). Otherwise the person whose sign-off was withdrawn would be the one person not told.
3. **A revoked file that reopens a delivery writes two rows** to that delivery's people: the file (`published_file_revoked`) and the delivery's move back to Prepared (`delivery_status`, no actor). Two records, each opening its own page.
4. **A failed validation counts as a job ending Failed**, because the event comes from the single status writer. Cancelling tells nobody.
5. **Reminders run hourly, not daily.** Each stage is written once per person and due date. An hourly run makes the reminder arrive soon after the studio's day starts in any time zone, and stage `due` covers today as well as tomorrow, so a missed run costs nothing. On the first run after the upgrade, milestones that fell due in the last 7 days are reminded once as overdue (checklist step 3).
6. **"Today" is the default work calendar's date** (UTC when there is none). Projects have no time zone of their own.
7. **RP-12 leftover fixed:** the RP-6 capture tool still called `_finish` with three arguments. The RP-6 and RP-11 samples were recaptured; the RP-11 preferences now list the new kinds.

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | clean |
| `ruff format` | new files formatted; every changed file was formatted at HEAD and still is |
| `manage.py check` | no issues |
| `makemigrations --check` | no changes (also `test_the_models_and_the_migrations_agree`) |
| `basedpyright` on the 23 changed and new backend files | 0 new errors (3 found in new files while building, fixed; `test_bootstrap.py` has 13, the same as at HEAD) |
| Backend tests, targeted: `apps/notifications apps/deliveries apps/publishing apps/scheduling apps/core/tests` | **2,438 passed** (an earlier run of the same set had one setup error in `publishing/tests/api/test_job_list_delete_type.py`; it passed alone, in a rerun of publishing (690 passed) and in this final run) |
| `test_rp13_notifications_beyond_reviews.py` | 45 passed |
| Changed elsewhere | `test_rp11_review_notifications.py` pins the mutable kinds (six added); `test_bootstrap.py` allows `notifications` three migrations; `test_dependency_direction.py` gains the notifications-reads-the-three-apps-through-selectors rule |
| Frontend `pnpm typecheck`, Biome (`--diagnostic-level=error`) | clean, 0 errors |
| Frontend `pnpm test` | 165 files, 1,830 tests passed |
| Frontend `pnpm build` | built |
| Unreachable code | only tests, row keys and the known helpers |
| Capture tools (RP-13 new, RP-6 and RP-11 recaptured) | pass |
| Live (`run_role_smoke.sh --vitest src/test/live/pipelineNotifications.live.test.tsx`) | 3 of 3 passed, first run |

## Mutation checks

Each change was made alone and must make a test fail; every file was restored afterwards (checked with `git diff`).

**Backend** (28 of 28 caught; one survived the first run and the test was fixed, see below):

- a working-state move notifies (survived at first: the test let the creator make the moves, so the actor rule hid it; now the coordinator validates and prepares the producer's delivery)
- the actor of a delivery move is told
- the client's answer is also told as a move
- delivery reach skips `delivery.view`
- delivery reach skips the project narrowing
- published file reach skips the project narrowing
- job reach skips `publishing.view`
- milestone reach skips `schedule.view`
- the signer whose sign-off was cleared by a reopen is forgotten
- the revocation forgets the unsent deliveries' people
- the revocation forgets the builders of dependent files
- a sent delivery's people are told of the file
- a cancelled job is told
- a job end forgets the version's people
- the delivery event is dispatched before commit (the rollback test)
- a reminder is written twice
- a completed milestone is reminded
- the overdue window is a month
- a milestone two days out is due
- the studio's time zone is ignored
- a delivery milestone forgets the delivery's creator
- a moved due date does not remind again
- one failing milestone stops the run
- a file's label is its full path
- a reminder's data loses its stage
- milestone completion by the creator is told
- the milestone event is not published
- an unknown target type reaches something

**Frontend** (14 of 14 caught): a delivery, job, file or milestone row opening the wrong page (4); the system reopen naming someone; the client's answer losing its status; a failed job read as exported; overdue read as due; a due date read as UTC midnight (caught by the west-of-UTC test); a revoked file losing its version; the milestone completion losing its name; a kind or a target type missing from the lists; a switch label renamed.

## Live run

A fresh `live_backend.py` seed and the studio's seeded roles. The supervisor makes and prepares a delivery: nobody is told. The producer signs it off, sends it and records the client's approval. The producer is told nothing. The supervisor is told, newest first: the client's answer (Approved), Signed Off → Submitted and Prepared → Signed Off, each with the producer as actor and no reason in the row. On the Notifications page the supervisor sees the step and the answer, the "Delivery steps" switch is on, and the row opens `/deliveries/{id}`. The supervisor sets a milestone and the producer completes it: the supervisor is told by name, and the row opens the project's Schedule tab.

## Not done in RP-13

- Leave requests (Q-RP-62), requests for action to every holder of a right (Q-RP-58 B), following a record.
- QC results, bookings, calendar events.
- The cleanup of the dead `notification.*` settings and `core/services/notifications.py`.

## Files

Backend, new: `apps/deliveries/events/status.py`, `apps/deliveries/selectors/notification_sources.py`, `apps/publishing/selectors/notification_sources.py`, `apps/scheduling/events/__init__.py`, `apps/scheduling/selectors/notification_sources.py`, `apps/notifications/sources.py`, `apps/notifications/services/reminders.py`, `apps/notifications/tasks/reminders.py`, `apps/notifications/migrations/0003_rp13_more_kinds.py`, `apps/notifications/tests/test_rp13_notifications_beyond_reviews.py`.
Backend, changed: `apps/deliveries/{events/__init__.py,services/transitions.py}`, `apps/publishing/{events/__init__.py,events/files.py,services/workflow.py}`, `apps/scheduling/services/milestone.py`, `apps/notifications/{constants.py,events/__init__.py,events/handlers.py,services/fanout.py,selectors/inbox.py,api/serializers.py,tasks/__init__.py,tests/test_rp11_review_notifications.py}`, `apps/core/tests/{test_dependency_direction.py,test_bootstrap.py}`, `config/settings/components/celery.py`.
Frontend: `src/api/notifications/{notifications.ts,__tests__/notificationsContracts.test.ts}`, `src/modules/notifications/{describe.ts,NotificationsPage.tsx,__tests__/notifications.test.tsx}`, `src/core/api/generated/{openapi.ts,schema/django-openapi.yml}`, `src/test/live/pipelineNotifications.live.test.tsx` (new).
Docs and tools: `docs/review-pipeline/{PLAN,DECISIONS,CONTRACTS}.md`, this report, `docs/apps/notifications.md`, `docs/07-deployment/pre-deploy-checklist.md`, `docs/sync/tools/test_capture_pipeline_notifications.py` (new), `docs/sync/tools/test_capture_notifications.py`, `docs/sync/samples/notifications/{_pipeline_notifications_flow.json (new),_notifications_flow.json,_review_notifications_flow.json}`.
