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

## RP-10 answers

The owner took every recommendation of [PLAN.md, RP-10 questions](PLAN.md#questions-before-rp-10-starts) on 2026-11-13 ("go ahead with second one", after choosing loose ends as the next phase).

| ID | Answer | What it means |
|---|---|---|
| Q-RP-41 | **A** | Upload, retry and remove of a review movie: holders of `version.update`, plus the version's artist when they hold `version.create`. No new code (C-RP-26). |
| Q-RP-42 | **A** | Notes stay out of the change log. The RP-2 follow-up is closed. Why: the change log is read with `audit.view`, which members narrowed to a show, a department, a client or a vendor can hold, while every notes route needs whole-project access (C-RP-10); a note's subject in the log would reach readers the notes routes refuse. A note's history stays its own fields (`addressed_by`, `addressed_at`, edits in place). |
| Q-RP-43 | **A** | The live harness processes queued review media itself, in-process, with the host's ffmpeg. |
| Q-RP-44 | **A** | A renewed link keeps the player's place: players are keyed by the review-media row, and the source is swapped. |
| Q-RP-45 | **A** | The notes views name their serializers for the OpenAPI schema (C-RP-27). |

## RP-11 answers

The owner took every recommendation of [PLAN.md, RP-11 questions](PLAN.md#questions-before-rp-11-starts) on 2026-11-14 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-46 | **A** | Review notifications: a decision, an invitation to give a verdict, a participant's verdict, a comment on your version and a reply in your thread (C-RP-28). |
| Q-RP-47 | **A** | `is_client_visible` is enforced: a client member is served only client-visible comments, is never told about the others, and what they write is client-visible. The composer gets an "Internal" switch for studio members. Vendors are unchanged (C-RP-29). |
| Q-RP-48 | **A** | Every kind can be muted except `note_mention` and `review_invited` (C-RP-30). |
| Q-RP-49 | **A** | A muted kind is not written for that person; unmuting brings nothing back. |
| Q-RP-50 | **A** | Only review decisions notify (`Approved`, `Rejected`, `Changes Requested`, `Retake`). |

## RP-12 answers

The owner took every recommendation of [PLAN.md, RP-12 questions](PLAN.md#questions-before-rp-12-starts) on 2026-11-16 ("go ahead", after choosing media depth as the next phase).

| ID | Answer | What it means |
|---|---|---|
| Q-RP-51 | **A** | A sequence is uploaded in parts: open, up to 50 frames per request, complete (C-RP-31). |
| Q-RP-52 | **A** | EXR, DPX, TIFF, PNG or JPEG frames; one name, one extension; no gap; at most `REVIEW_MEDIA_MAX_FRAMES` (2,000) frames and `REVIEW_MEDIA_SEQUENCE_MAX_BYTES` (20 GiB). |
| Q-RP-53 | **A** | A fixed colour rule: EXR from linear to sRGB, the rest as stored; not for colour approval (C-RP-32). |
| Q-RP-54 | **A** | Burn-ins in a fixed layout, switched per project (`review_burn_ins`, off by default), on movies and sequences (C-RP-33). |
| Q-RP-55 | **A** | A ready sequence sets the version's frame range only when neither end is set (C-RP-32). |
| Q-RP-56 | **A** | A sequence's frames are deleted when its copy is ready; a failed job keeps them for a retry. |

## RP-13 answers

The owner took every recommendation of [PLAN.md, RP-13 questions](PLAN.md#questions-before-rp-13-starts) on 2026-11-16 ("go ahead", after choosing notifications beyond reviews as the next phase).

| ID | Answer | What it means |
|---|---|---|
| Q-RP-57 | **A** | Deliveries, publish jobs, published files and milestones notify (C-RP-34, C-RP-35). |
| Q-RP-58 | **A** | A delivery tells the people named on it: its creator, whoever signed it off, whoever sent it. No request for action to every holder of a right. |
| Q-RP-59 | **A** | Only the steps people wait for: arriving at Signed Off, Submitted, Approved, Rejected, Complete or Cancelled, and leaving Signed Off or a sent status. |
| Q-RP-60 | **A** | A publish job ending Exported or Failed, and a revoked file. Registering a file tells nobody. |
| Q-RP-61 | **A** | A milestone is reminded at most twice (due, overdue) to the people named on it; completing it tells its creator (C-RP-36). |
| Q-RP-62 | **A** | Leave requests are not in RP-13. |

## Phases after the answers

| Phase | Status |
|---|---|
| RP-1 Data model cleanup | built and merged into `develop` ([rp-1-verification.md](rp-1-verification.md)) |
| RP-2 Notes (replies, links) | built and merged into `develop` ([rp-2-verification.md](rp-2-verification.md)) |
| RP-3 Approval roll-up (fixed rule) | built and merged into `develop` ([rp-3-verification.md](rp-3-verification.md)) |
| RP-4 Publishing depth | built and merged into `develop` ([rp-4-verification.md](rp-4-verification.md)) |
| RP-5 Media pipeline (ffmpeg worker) | planned in [PLAN.md](PLAN.md#rp-5-media-pipeline-review-movies-thumbnails-filmstrips); answered (Q-RP-24 to Q-RP-31 = A); built and merged into `develop`, released in v4.6.0 ([rp-5-verification.md](rp-5-verification.md)) |
| RP-6 Notifications (in-app) | planned in [PLAN.md](PLAN.md#rp-6-notifications-in-app); answered (Q-RP-32 to Q-RP-40 = A); built and merged into `develop`, released in v4.7.0 ([rp-6-verification.md](rp-6-verification.md)) |
| RP-7 Share links | **dropped** (Q-RP-8 = B) |
| RP-8 Live review | not planned (Q-RP-9 = B) |
| RP-9 DCC integrations | separate repository (Q-RP-10 = B) |
| RP-10 Loose ends of RP-5 and RP-6 | planned in [PLAN.md](PLAN.md#rp-10-loose-ends-of-rp-5-and-rp-6); answered (Q-RP-41 to Q-RP-45 = A), built and merged into `develop`, released in v4.8.0 ([rp-10-verification.md](rp-10-verification.md)) |
| RP-11 Notification depth (reviews and preferences) | planned in [PLAN.md](PLAN.md#rp-11-notification-depth-reviews-and-preferences); answered (Q-RP-46 to Q-RP-50 = A); committed `a7443900`, merged into `develop` and `main`, released in v4.9.0 ([rp-11-verification.md](rp-11-verification.md)) |
| RP-12 Media depth (image sequences and burn-ins) | planned in [PLAN.md](PLAN.md#rp-12-media-depth-image-sequences-and-burn-ins); answered (Q-RP-51 to Q-RP-56 = A); committed `f2b84225`, merged into `develop` and `main`, released in v4.9.0 ([rp-12-verification.md](rp-12-verification.md)) |
| RP-13 Notifications beyond reviews (deliveries, publishing, milestones) | planned in [PLAN.md](PLAN.md#rp-13-notifications-beyond-reviews-deliveries-publishing-milestones); answered (Q-RP-57 to Q-RP-62 = A); committed `88a24c4b`, merged into `develop` and `main`, released in v4.10.0 ([rp-13-verification.md](rp-13-verification.md)) |
| RP-14 Review copies: remaking and slates | planned in [PLAN.md](PLAN.md#rp-14-review-copies-remaking-and-slates); answered (Q-RP-63 to Q-RP-67 = A); committed `10fedb13`, merged into `develop` and `main`, released in v4.11.0 ([rp-14-verification.md](rp-14-verification.md)) |
| RP-15 Colour management for review copies | planned in [PLAN.md](PLAN.md#rp-15-colour-management-for-review-copies); answered (Q-RP-68 to Q-RP-72 = A); committed `ae0c6dde`, merged into `develop` and `main`, released in v4.12.0 ([rp-15-verification.md](rp-15-verification.md)) |
| RP-16 Sequence copies after a settings change | planned in [PLAN.md](PLAN.md#rp-16-sequence-copies-after-a-settings-change); answered (Q-RP-73 to Q-RP-76 = A); committed `eb5cb64d`, merged into `develop` and `main`, released in v4.13.0 ([rp-16-verification.md](rp-16-verification.md)) |
| RP-17 Review copies from studio storage | planned in [PLAN.md](PLAN.md#rp-17-review-copies-from-studio-storage); answered (Q-RP-77 to Q-RP-81 = A); committed `d06c0572`, merged into `develop` and `main`, released in v4.14.0 ([rp-17-verification.md](rp-17-verification.md)) |
| RP-18 Review copies before approval | planned in [PLAN.md](PLAN.md#rp-18-review-copies-before-approval); answered (Q-RP-82 to Q-RP-86 = A); committed `bfaf6466`, merged into `develop` and `main`, released in v4.15.0 ([rp-18-verification.md](rp-18-verification.md)) |
| RP-19 Copy ready to review | planned in [PLAN.md](PLAN.md#rp-19-copy-ready-to-review); answered (Q-RP-87 to Q-RP-91 = A); committed `d17c3ccd`, merged into `develop` and `main`, released in v4.16.0 ([rp-19-verification.md](rp-19-verification.md)) |
| RP-20 Per-shot grades on review copies | planned in [PLAN.md](PLAN.md#rp-20-per-shot-grades-on-review-copies); answered (Q-RP-92 to Q-RP-96 = A); committed `10f16b62`, merged into `develop` and `main`, released in v4.17.0 ([rp-20-verification.md](rp-20-verification.md)) |
| RP-21 The task and its reviewer on the version page | planned in [PLAN.md](PLAN.md#rp-21-the-task-and-its-reviewer-on-the-version-page); answered (Q-RP-97 to Q-RP-100 = A); committed `5b303561`, merged into `develop` and `main`, released in v4.18.0 ([rp-21-verification.md](rp-21-verification.md)) |
| RP-22 Grades from EDLs and ALEs | planned in [PLAN.md](PLAN.md#rp-22-grades-from-edls-and-ales); answered (Q-RP-101 to Q-RP-104 = A); committed `d5d2576c`, merged into `develop` and `main`, released in v4.19.0 ([rp-22-verification.md](rp-22-verification.md)) |
| RP-23 Downloading a review copy | planned in [PLAN.md](PLAN.md#rp-23-downloading-a-review-copy); answered (Q-RP-105 to Q-RP-108 = A); committed `c58da79c`, merged into `develop` and `main`, released in v4.20.0 ([rp-23-verification.md](rp-23-verification.md)) |
| RP-24 Waiting for my review | planned in [PLAN.md](PLAN.md#rp-24-waiting-for-my-review); answered (Q-RP-109 to Q-RP-112 = A); committed `3786373c`, merged into `develop` and `main`, released in v4.21.0 ([rp-24-verification.md](rp-24-verification.md)) |
| RP-25 Slates on downloaded copies | planned in [PLAN.md](PLAN.md#rp-25-slates-on-downloaded-copies); answered (Q-RP-113 to Q-RP-116 = A); built on `feature/rp-25-download-slates`, not committed ([rp-25-verification.md](rp-25-verification.md)) |

Phase numbers are not reused, so RP-7 stays empty.

## RP-14 answers

The owner took every recommendation of [PLAN.md, RP-14 questions](PLAN.md#questions-before-rp-14-starts) on 2026-11-17 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-63 | **A** | No slates on review copies. Slates are rendered by the studio's pipeline before upload; a slate inside the copy would shift every stored frame number. WP 14.3 drops. |
| Q-RP-64 | **A** | Movies and stills can be remade from their kept upload; a sequence cannot (its frames are gone, Q-RP-56 stands) and is told to upload its frames again. |
| Q-RP-65 | **A** | A "Remake" action on one copy, and "Remake the copies that differ" for a project after its burn-in switch changes. Nothing is remade automatically. |
| Q-RP-66 | **A** | A remade copy keeps the original copy's burn-in date; a copy made before RP-14 dates from the day its row was created. |
| Q-RP-67 | **A** | A remade copy that becomes ready tells nobody; one that fails tells whoever asked for the remake (`review_media_failed`). |

## RP-15 answers

The owner took every recommendation of [PLAN.md, RP-15 questions](PLAN.md#questions-before-rp-15-starts) on 2026-11-17 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-68 | **A** | A setting, `REVIEW_MEDIA_OCIO_CONFIG`, names the OpenColorIO config; by default the pinned built-in ACES 2.0 studio config (`ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6`). A studio on ACES 1.3 or with its own `config.ocio` sets it. |
| Q-RP-69 | **A** | EXR frames use the project's `color_space`; movies and other frames are shown as stored unless their upload names a colour space. `Version.color_space` is not read. |
| Q-RP-70 | **A** | A project chooses a view and an optional look of the sRGB display. No P3 or HDR copies. |
| Q-RP-71 | **A** | A project write that changes `color_space`, `review_view` or `review_look` must name one the config knows (400 on the field otherwise); stored values are left, and one the config does not know means "no transform" for new copies, said in the probe. |
| Q-RP-72 | **A** | Copies made with other colour settings are counted in the project's review-copies notice and the movies among them remade as in RP-14; sequences cannot be remade. |

## RP-16 answers

The owner took every recommendation of [PLAN.md, RP-16 questions](PLAN.md#questions-before-rp-16-starts) on 2026-11-17 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-73 | **A** | A setting, `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS` (default 14), keeps a sequence's frames that many days once its copy is ready, so it can be remade; 0 deletes them at once, as before. |
| Q-RP-74 | **A** | A remake keeps the original's `frames_until`; it never keeps the frames longer. |
| Q-RP-75 | **A** | The copies read lists the first 100 differing copies, oldest first, and how many more. |
| Q-RP-76 | **A** | Copies that cannot be remade can be kept as they are by whoever may change the project; they count again once its burn-ins, colour space, view or look change. Movies cannot be kept, they can be remade. |

## RP-17 answers

The owner took every recommendation of [PLAN.md, RP-17 questions](PLAN.md#questions-before-rp-17-starts) on 2026-11-18 ("Build with all A").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-77 | **A** | A review copy can be read from a registered published file only (role `main` or `proxy`, not Revoked), and is placed on that file's own version. No typed paths. |
| Q-RP-78 | **A** | The media worker reads the roots in `PUBLISHING_STORAGE_MOUNTS`, mounted read-only into `celery-media`. No second list. |
| Q-RP-79 | **A** | A file whose checksum is `mismatch` or `missing` is refused; `declared` and `verified` are accepted; nothing is hashed. |
| Q-RP-80 | **A** | No automatic copies: they are made by hand, or by pipeline tools through the same route. |
| Q-RP-81 | **A** | Copies made from a file that is then revoked stay, but cannot be remade; one in flight fails. |

## RP-18 answers

The owner took every recommendation of [PLAN.md, RP-18 questions](PLAN.md#questions-before-rp-18-starts) on 2026-11-18 ("Build with all A").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-82 | **A** | An unpublished version's copy is read from a path given in the request, stored on the review row as a storage source. Nothing is registered and the version stays unpublished. |
| Q-RP-83 | **A** | Only paths under the project's review folder (one root and folder, set by whoever may change the project), checked in the request and again by the worker. |
| Q-RP-84 | **A** | The caller gives a sequence's frame range; the panel prefills the version's frames; missing frames fail the job. |
| Q-RP-85 | **A** | Nothing automatic on the server: the render-farm tool calls the route when a render finishes. |
| Q-RP-86 | **A** | The folder is shown only to those who may change the project; review rows show the file name only; refusals never name a directory. |

## RP-19 answers

The owner took every recommendation of [PLAN.md, RP-19 questions](PLAN.md#questions-before-rp-19-starts) on 2026-11-18 ("I recommend all A").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-87 | **A** | The reviewer is the version's task's reviewer (`Task.reviewer`). A version without a task, or a task without a reviewer, tells no reviewer; there is no fallback to the project's supervisor. |
| Q-RP-88 | **A** | Only the first copy of a source tells the reviewer: an upload, a published file or a path, not a remake, and only while the version is not `Approved` or `Archived`. |
| Q-RP-89 | **A** | The reviewer is never told about a failed copy. |
| Q-RP-90 | **A** | The version's artist gets `review_media_ready` or `review_media_failed` when someone else made the copy; the task's assignee does not. |
| Q-RP-91 | **A** | `review_media_to_review` can be muted. |

## RP-20 answers

The owner took every recommendation of [PLAN.md, RP-20 questions](PLAN.md#questions-before-rp-20-starts) on 2026-11-18 ("all A").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-92 | **A** | A grade lives on the shot; every version of the shot gets it. No per-version grade. |
| Q-RP-93 | **A** | Grades are typed on the shot, or imported from a client's `.cc`, `.ccc` or `.cdl` file on the project, matched to shot codes, with a dry run first. |
| Q-RP-94 | **A** | The grade is applied in the config's grading space (`color_timing`, ACEScct in the ACES configs), before the project's look. |
| Q-RP-95 | **A** | Only colour-managed copies get it, and only while the project's switch is on (off by default). |
| Q-RP-96 | **A** | Copies made with another grade are counted in the review-copies notice (reason `grade`) and remade by the project remake, not automatically. |


## RP-21 answers

The owner took every recommendation of [PLAN.md, RP-21 questions](PLAN.md#questions-before-rp-21-starts) on 2026-11-19 ("all A, go").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-97 | **A** | The version's overview gains three facts after *Artist*: Task (linked to the task), Assignee, Reviewer. |
| Q-RP-98 | **A** | The page reads the task with `GET tasks/{task_id}/`; whoever may not read the task (a client member, a role without `task.view`) sees none of the three. No backend change. |
| Q-RP-99 | **A** | The Reviewer fact reads "You" for the task's reviewer. |
| Q-RP-100 | **A** | Nothing is edited from the version page; the task's edit page sets the assignee and the reviewer. |

## RP-22 answers

The owner took every recommendation of [PLAN.md, RP-22 questions](PLAN.md#questions-before-rp-22-starts) on 2026-11-19 ("go ahead").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-101 | **A** | An EDL event's names are tried in turn: its locators, its clip names (TO, then FROM, without the extension), its reel. The first that matches a shot names it; names matching different shots make the event invalid. |
| Q-RP-102 | **A** | An ALE row's names are the first present of the `Shot`, `VFX`, `VFX ID` and `Shot Name` columns (ignoring case), then `Name`. |
| Q-RP-103 | **A** | One shot in several events with the same grade is one correction; with different grades every one of them is invalid and the shot keeps its grade. |
| Q-RP-104 | **A** | Events and rows without a grade are counted (`ungraded`), not listed. |

## RP-23 answers

The owner took every recommendation of [PLAN.md, RP-23 questions](PLAN.md#questions-before-rp-23-starts) on 2026-11-19 ("all A, go").

| ID | Answer | Meaning |
|---|---|---|
| Q-RP-105 | **A** | A project switch, `review_downloads`: `internal` (the default), `everyone` or `nobody`. External members may download only under `everyone`. |
| Q-RP-106 | **A** | The review copy as made (the MP4, or the JPEG for a still), with its burn-ins and grade; never the original upload or frames. |
| Q-RP-107 | **A** | An audit row per download (who, the copy, the version, the client IP), written when the response starts at byte 0. |
| Q-RP-108 | **A** | A Download link in the review movie panel and the review player; not on the Versions list. |

## RP-24 answers

The owner took every recommendation of [PLAN.md, RP-24 questions](PLAN.md#questions-before-rp-24-starts) on 2026-11-19 ("Approved").

| ID | Answer | Meaning |
|---|---|---|
| Q-RP-109 | **A** | Waiting for my review: versions in `Pending Review` on a live task whose reviewer is me. Review sessions' reviewers are not counted, and a version needs no ready copy. |
| Q-RP-110 | **A** | `versions/?to_review=mine`, always the caller; `tasks/?reviewer_id=<id>`, as `assignee_id`. |
| Q-RP-111 | **A** | A *To review: Mine* filter on the Versions list, *Reviewer: Me* on the Tasks list, and a link from the "copy to review" notices. No dashboard widget or new page. |
| Q-RP-112 | **A** | No count of what waits. |

## RP-25 answers

The owner took every recommendation of [PLAN.md, RP-25 questions](PLAN.md#questions-before-rp-25-starts) on 2026-11-20 ("All A, build it").

| ID | Answer | Meaning |
|---|---|---|
| Q-RP-113 | **A** | A project switch, `review_slates`, off by default; movie and sequence copies made while it is on; stills never. |
| Q-RP-114 | **A** | The slate says the facts (project, shot or asset, version, task, artist, frames, date) and the project's own line, `review_slate_note`. Not who downloaded it. |
| Q-RP-115 | **A** | A card encoded with the copy's settings, joined to the copy without re-encoding it and checked; a failure leaves the copy without a slate (`slate_skipped`). |
| Q-RP-116 | **A** | Copies made before the switch download without a slate and count as differing (`slate`), so *Remake them* adds it. |

Decided while building, within the answers:
- **The probe's `slate` and `slate_skipped` are shown** (C-RP-59), as RP-20 shows `grade_skipped`, so a client can say whether a download has a slate; the Download link's title says so.
- **The copies read counts the slate** (`review_slates`, `slate_out_of_date`, C-RP-60), as RP-20 counts grades.
- **Each line of the card is sized to fit** the copy's width (a long code, or a 120-character line), at most the usual size.
