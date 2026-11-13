# Review pipeline: decisions

The owner answered the questions of [ANALYSIS.md §9](ANALYSIS.md#9-decisions-for-the-owner) on 2026-11-12: "go with suggestion, Q-RP-8 no".

| ID | Answer | What it means |
|---|---|---|
| Q-RP-1 | **A**, keep the split | `Version` is what is reviewed; `PublishedFile` (publishing app) is what is published and loaded. Neither is merged into the other. |
| Q-RP-2 | **A**, reverse delivery-pipeline Q5/Q6 | For this programme, the items of [ANALYSIS.md §8](ANALYSIS.md#8-draft-phases-to-be-fixed-after-9-is-answered) are in scope: notes with replies and links, approval roll-up, publish dependencies, the loader, path templates, the media pipeline and notifications. This replaces the earlier "LATER" answer for these items only. |
| Q-RP-3 | **A**, the order of §8 | RP-1 (data cleanup) comes first. |
| Q-RP-4 | **B**, keep both | Review comments stay their own records. RP-2 adds replies and links to several records to project notes. They can be merged later if wanted. |
| Q-RP-5 | **A**, a fixed rule, switched on per project | When a version is approved, its task is approved, if the project's rule says so. No `AutomationRule` engine for now. |
| Q-RP-6 | **A**, ffmpeg in the worker image | Results are written to a storage root. Object storage (S3-compatible) can come later, if the deployment has it. |
| Q-RP-7 | **A**, in-app only | No e-mail, so no new outward channel. |
| Q-RP-8 | **B**, no account-free share links | Clients review with their own accounts, as they already can. The trust model does not change, and no ADR is needed. **RP-7 is dropped.** `Playlist.share_settings` stays a stored marker: the frontend already labels it "Marked shared", and no route serves it. Delivery-pipeline Q30 (share links: LATER) stays as it is. |
| Q-RP-9 | **B**, live review later | RP-8 is not planned now. It would need a Redis channel layer and an ASGI server in production. |
| Q-RP-10 | **B**, a separate repository | DCC and desktop tools (RP-9) are a different runtime with a different release cycle. They are built outside this repository, against the API. |

## RP-2 answers

The owner took every recommendation of [PLAN.md, RP-2 questions](PLAN.md#questions-before-rp-2-starts) on 2026-11-12 ("next").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-11 | **A** | The author edits their own note. The author, the assignee of the note's task, or a holder of `note.update` changes its status. `note.update` is granted to platform-admin, org-admin, production-admin, vfx-supervisor and lead; editing another person's note needs it. |
| Q-RP-12 | **A** | Soft delete, by the author while no one else has replied, or by a holder of `note.delete` (platform-admin, org-admin, production-admin, vfx-supervisor). A thread's replies go with it. |
| Q-RP-13 | **A** | A narrowed member still sees only the threads they wrote, now with every reply on them. The trust model does not change; no ADR. |
| Q-RP-14 | **A** | Links to Sequence, Shot, Asset, Version, Playlist, Review, and Episode on episodic projects. The task is its own field, not a link. |

## RP-3 answers

The owner took every recommendation of [PLAN.md, RP-3 questions](PLAN.md#questions-before-rp-3-starts) on 2026-11-12 ("do it as per suggestion").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-15 | **A** | When a version is approved, its task moves to `Approved` from any working state. `Approved` and `Archived` tasks are left alone. |
| Q-RP-16 | **A** | A version that leaves `Approved` later does not touch the task. Its `Approved` is corrected by hand, with `production.status.override` and a reason. |
| Q-RP-17 | **A** | The switch is off for every project, old and new. Whoever may create or edit the project sets it on the project form. |
| Q-RP-18 | **A** | The approval of any live version of the task counts. |

## RP-4 answers

The owner took every recommendation of [PLAN.md, RP-4 questions](PLAN.md#questions-before-rp-4-starts) on 2026-11-12 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-19 | **A** | Dependencies are written only when the downstream file is registered, and never changed. Every upstream exists first, so no cycle can form; there is no cycle check and no lock. |
| Q-RP-20 | **A** | An upstream is a file of the same project. |
| Q-RP-21 | **B** | The loader picks `latest`, `approved` or `hero`. |
| Q-RP-22 | **B** | Each template has an `enforce` switch, off by default. Only an enforcing template refuses a registration. |
| Q-RP-23 | **A** | Studio-wide templates, overridden by a project's own, managed with the new code `publishing.template.manage` (platform-admin, org-admin, production-admin). |

## RP-5 answers

The owner took every recommendation of [PLAN.md, RP-5 questions](PLAN.md#questions-before-rp-5-starts) on 2026-11-13 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-24 | **A** | Uploads and results live under `MEDIA_ROOT/review_media/` and leave only through signed links, as attachments do. |
| Q-RP-25 | **A** | A job starts from a file uploaded to the version. Published files on storage roots can come later. |
| Q-RP-26 | **A** | Movies (`mov`, `mp4`, `m4v`, `mkv`, `webm`, `mxf`, `avi`) and display-ready stills (`jpg`, `png`, `tif`). EXR and DPX are refused. |
| Q-RP-27 | **A** | One deployment setting, `REVIEW_MEDIA_ENABLED`, off by default. The feature flags stay unread. |
| Q-RP-28 | **A** | A playback link lasts one hour; every request re-checks the user and their access. |
| Q-RP-29 | **A** | The probe never changes the version's fields; the player uses the probe's frame rate for the proxy. |
| Q-RP-30 | **A** | Upload, retry and remove need `version.update` with the version in reach. |
| Q-RP-31 | **A** | At most 2 GiB per upload (`REVIEW_MEDIA_MAX_BYTES`), no quota. |

## RP-6 answers

The owner took every recommendation of [PLAN.md, RP-6 questions](PLAN.md#questions-before-rp-6-starts) on 2026-11-13 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-32 | **A** | A new app, `apps/notifications`, holds the inbox, its routes and the handlers. It reads production through production's selectors; production never imports it. |
| Q-RP-33 | **A** | Notes, mentions, replies, note status, task assignment, task status, version status and review movies notify, as in the plan's table. Review comments do not, for now. |
| Q-RP-34 | **A** | Mentions are `mention_ids` chosen from a member picker, checked and stored as rows. The body is not parsed. |
| Q-RP-35 | **A** | A row keeps ids, its kind and status names. Labels are read from the live records when the inbox is fetched. |
| Q-RP-36 | **A** | The browser polls `unread-count/` every 60 seconds while the tab is visible, and on focus. No websocket. |
| Q-RP-37 | **A** | No preferences in RP-6. |
| Q-RP-38 | **A** | Rows are kept 90 days (`NOTIFICATIONS_RETENTION_DAYS`) and purged daily. |
| Q-RP-39 | **A** | The bell shows the server inbox only; toasts are unchanged. |
| Q-RP-40 | **A** | Always on; no switch. |

## Phases after the answers

| Phase | Status |
|---|---|
| RP-1 Data model cleanup | built and merged into `develop` ([rp-1-verification.md](rp-1-verification.md)) |
| RP-2 Notes (replies, links) | built and merged into `develop` ([rp-2-verification.md](rp-2-verification.md)) |
| RP-3 Approval roll-up (fixed rule) | built and merged into `develop` ([rp-3-verification.md](rp-3-verification.md)) |
| RP-4 Publishing depth | built and merged into `develop` ([rp-4-verification.md](rp-4-verification.md)) |
| RP-5 Media pipeline (ffmpeg worker) | planned in [PLAN.md](PLAN.md#rp-5-media-pipeline-review-movies-thumbnails-filmstrips); answered (Q-RP-24 to Q-RP-31 = A); built and merged into `develop`, released in v4.6.0 ([rp-5-verification.md](rp-5-verification.md)) |
| RP-6 Notifications (in-app) | planned in [PLAN.md](PLAN.md#rp-6-notifications-in-app); answered (Q-RP-32 to Q-RP-40 = A); built and committed on `feature/rp-6-notifications`, not merged ([rp-6-verification.md](rp-6-verification.md)) |
| RP-7 Share links | **dropped** (Q-RP-8 = B) |
| RP-8 Live review | not planned (Q-RP-9 = B) |
| RP-9 DCC integrations | separate repository (Q-RP-10 = B) |

Phase numbers are not reused, so RP-7 stays empty.
