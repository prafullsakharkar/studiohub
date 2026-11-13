# Versions, publishing and reviews: gap analysis against ShotGrid and ftrack (Phase 0)

- **Branch / base:** `analysis/review-pipeline` from `develop` at `4d346bf7` (v4.5.0 plus the 4.5.0 checklist entries). This phase is read-only: no code or data changed.
- **Asked by the owner (2026-11-12):** "We need all of the above". This means the ShotGrid / Flow Production Tracking and ftrack handling of versions, publishing and reviews, as summarised in the conversation of that day.
- **Reference model:** ShotGrid (Version, PublishedFile, Playlist, Note, Toolkit) and ftrack (Asset, AssetVersion with components and locations, Lists, review sessions). Both are used as design references only, weighed against this repository's rules (AGENTS.md, ADRs, the layered architecture).
- **Earlier scope decisions this request reverses:**
  - delivery-pipeline Q5/Q6 put "ShotGrid-style features", publish dependencies and notifications in LATER (`docs/delivery-pipeline/DECISIONS.md` Q5, Q6, A-32; `VERIFICATION.md` §5);
  - Q4/Q30 ruled out account-free links and notification channels. SEC-DLV-06 already lists the rules any link must follow, and requires an ADR.
  - The answers to the questions in §6 replace those entries.

States used below: **Present** (built and enforced), **Partial** (part is built, or it is stored but not enforced), **Missing**.

## 1. Versions

| Concept (ShotGrid / ftrack) | StudioHub today | State | Evidence |
|---|---|---|---|
| A reviewable iteration linked to a shot or asset and a task (Version / AssetVersion) | `production.Version`: `shot` or `asset` (never both), `task`, `artist`, `department` | Present | `apps/production/models/version.py:33-61`, check constraint `production_version_one_entity_ck` |
| Version numbering per stream | `version_index` unique per task, or per shot or asset when there is no task; numbers are never reused | Present | `version.py` constraints `production_version_{task,shot,asset}_index_uniq` |
| Status and approval on the version | `status` through `StatusService` (transition maps, separation of duties, history) | Present | `apps/production/services/status.py`; `StatusHistory` |
| "Current" or hero version of a shot | `is_hero` (one live hero per shot or asset); the derived current version is the latest published, else the latest | Present | `version.py` hero constraint; `selectors/rollups.py:77` `ShotCurrentVersionSelector` |
| Media on the version (uploaded movie, frames path, thumbnail, filmstrip) | `video_url`, `thumbnail_url`, `source_file_url`, `file_path`, frame range, fps, colour space; URLs typed in, nothing produced | Partial | `version.py:82-93`; §3 |
| Reviews, playlists, notes, activity of a version | Returned from JSON lists stored *on the version* (`reviews`, `playlists`, `notes_list`, `media_items`, `attachments`, `activity`), not from the review and playlist records | **Partial, inconsistent** | `version.py:99-105`; `api/serializers/version/base.py:31` returns them as stored. Reviews and playlists became records in D-30 and D-31 (`ReviewItem`, `PlaylistEntry`), so these lists can disagree with the truth |
| Files of a version (Version ↔ PublishedFile) | `PublishedFile.version` (PROTECT), roles main, proxy, thumbnail, sidecar | Present | `apps/publishing/models/file.py:76-105` |

## 2. Publishing

| Concept | StudioHub today | State | Evidence |
|---|---|---|---|
| Published file record (path, type, version number, links) | `PublishedFile`: storage root and relative path, `file_type` (masterdata `MasterFileType`), size, SHA-256, frames, role, export job | Present | `publishing/models/file.py:93-134` |
| Publish lifecycle and its history | Registered, Deprecated, Revoked, with reason, actor and override; append-only `PublishedFileEvent` | Present | `file.py:80-85, 234-247` |
| Storage roots with paths per operating system (ShotGrid Local Storage / ftrack Location) | `StorageRoot`: `linux_path`, `windows_path`, `mac_path` | Present | `publishing/models/storage.py:24-28` |
| Checksums verified on disk | `verify_file` and `manage.py verify_published_files` | Partial: not scheduled | `publishing/tasks/verify.py`. Nothing queues it (`tests/tasks/test_verify.py:173`). Its docstring says "the repository defines no Celery app", which is stale (§7) |
| Export or publish jobs with validation | `PublishItem` (DCC tool and version, export path and format, validation rules and results, retries, `republished_from`) and `PublishValidationRule` | Present (data); Partial (nothing runs a DCC export) | `publishing/models/__init__.py:74-316` |
| Publish destinations | `PublishDestination` (type, path, protocol, region) | Present (data) | `publishing/models/__init__.py:373-407` |
| "Latest" publish | Newest Registered file **per version and role**, derived and never stored | Partial | `publishing/selectors/files.py:88-105` |
| Loader query: latest or approved publish of type T for shot X, across versions | None | **Missing** | No selector or route takes shot or asset, file type and "approved" |
| Upstream and downstream dependencies between publishes | Only a validation-rule *type* named `dependencies` | **Missing** | `publishing/models/__init__.py:258`. Q5 put dependencies in LATER (`docs/publishing/PLAN.md:80`) |
| Path and naming templates (Toolkit `templates.yml`) | `relative_path` is free text; codes are numbered by `PublishCounter` | **Missing** | `file.py:103`, `publishing/models/counter.py` |
| Attachments on a version, review or shot | `core.Attachment` links to nothing | **Missing** (CR-52 proposed) | `docs/sync/backend-change-requests.md` CR-52 |

## 3. Media

| Concept | StudioHub today | State | Evidence |
|---|---|---|---|
| Media record | `production.Media` (entity, type, format, storage tier, source, preview and thumbnail URLs, resolution, size) | Present (data) | `apps/production/models/media.py:13-42` |
| Upload, then a web movie, thumbnail and filmstrip made by the server | No upload on `Media` and no processing anywhere | **Missing** | No `ffmpeg` / `ffprobe` / OIIO use in `apps/`; the Django image installs no ffmpeg (`infrastructure/docker/django/Dockerfile`) |
| Switches for automatic transcoding | Flags `media_auto_transcode` and `video_auto_transcode` exist and nothing reads them | Partial (dead flags) | `apps/settings/constants/feature_flags.py:31,54` |
| Player | Frame-accurate player, annotation drawing, compare (Wipe/Split, Side-by-Side, Difference, Onion Skin, A/B Flip) | Present (frontend) | `docs/sync/phase-31..33-verification.md` |

## 4. Reviews and dailies

| Concept | StudioHub today | State | Evidence |
|---|---|---|---|
| Review session with ordered versions | `Review` with `ReviewItem` (ordered, a version once per review) | Present | `models/review_parts.py:21-43` |
| Reviewers and per-person verdicts | `ReviewParticipant` (`verdict`, notes, time) and `supervisor_verdict` on the review | Present | `review_parts.py:45-80`, `models/review.py:36` |
| Dailies list (Playlist / List) | `Playlist` with `PlaylistEntry` (ordered versions) | Present | `models/playlist.py`, `playlist_entry.py` |
| Frame-referenced comments with replies | `ReviewComment` (`parent`, `frame_number`, `timecode`, resolved, client-visible) | Present, with a gap | `review_parts.py:82-120`. The comment belongs to the review, **not to a version in it**: in a review of several versions, "frame 1012" does not say which version |
| Drawings on a frame | `ReviewAnnotation` (`frame_number`, `timecode`, `drawing_coordinates`) | Present, with the same gap | `review_parts.py:150-176`. The docstring says "on a version in the review", but there is no version field |
| Review activity trail | `ReviewActivity` | Present | `review_parts.py:177-195` |
| Approval passed on to the task (version approved, task approved) | `StatusService` publishes `StatusChanged` after commit; **nothing subscribes** | **Missing** | `services/status.py:326`; no handler of `StatusChanged` in `apps/` |
| Configurable automations (ShotGrid event daemon / ftrack actions) | `AutomationRule` (trigger event, filters, actions) and `AutomationAuditLog` are stored; **no engine runs a rule** | Partial (data only) | `models/automation.py:13-71`; `services/automation.py:94` `log_execution` is "engine hook; no write endpoint" |
| Live, synced review | Channels is installed and the ASGI router has **no websocket routes** | **Missing** | `config/asgi.py:23-26` |
| RV, cineSync or Live Review integration | None | **Missing** | none |

## 5. Notes, notifications, outside reviewers

| Concept | StudioHub today | State | Evidence |
|---|---|---|---|
| A note on any record (ShotGrid Note) | `ProjectNote` on one entity (type, id, code, name), with category, priority, status, frame and timecode; `ReviewNote` on a review | Partial | `models/project_note.py:33-86` |
| One note linked to several records (version, shot, task, playlist) | One entity per note | **Missing** | `project_note.py:45-48` |
| Replies on notes | `ProjectNote` has no parent (`ReviewComment` does) | **Missing** for project notes | `project_note.py` |
| Notifications (note on my version, assignment, approval) | None. The former `platform` notifications app was removed, and delivery-pipeline Q30 chose A ("audit rows only") | **Missing** | `CLAUDE.md` installed apps; `docs/delivery-pipeline/DECISIONS.md:78` |
| Client reviewers with an account | Client and vendor memberships, narrowed to the reviews they take part in and those reviews' versions and media | Present | `tests/security/test_external_segregation.py:379-391` |
| Share link without an account (ShotGrid client review site / ftrack review session link) | `Playlist.share_settings` stores `is_public`, `require_passcode`, `client_id` and `expires_at`; **no route serves it**, and the only `AllowAny` views are sign-in and password reset | **Partial (stored, not enforced)** | `models/playlist.py:29`; `api/serializers/actions.py:152-157`; SEC-DLV-06 lists the rules and requires an ADR |

## 6. Integrations

| Concept | StudioHub today | State |
|---|---|---|
| DCC publishing and loading (Toolkit publisher and loader, ftrack Connect) | `PublishItem` records the DCC tool and version, but there is no client package, plugin or published API client for Maya, Nuke or Houdini | **Missing** |
| Desktop review players (RV, cineSync) | None | **Missing** |

## 7. Facts that change the plan

- **Background jobs exist.**
  - The Celery app is `core.celery:app` (`backend/core/celery.py:12`, `autodiscover_tasks()`).
  - The dev and prod compose files run `celery` and `celery-beat` (`infrastructure/compose/compose.dev.yml:49,71`, `compose.prod.yml:112,129`).
  - Only identity, audit and publishing (`publishing.verify_file`, which nothing queues) define tasks.
  - `config/celery.py` is an empty file. The publishing comment that says "no Celery app" is stale; it should be corrected when publishing is next touched.
- **No media toolchain.** The image has no ffmpeg, and no media library is a dependency. Transcoding needs both, and a place to write the results.
- **Websockets are half there.** `channels>=4.2` is a dependency and `config/asgi.py` builds a `ProtocolTypeRouter` with `AuthMiddlewareStack`, but there are no consumers and no `CHANNEL_LAYERS`. Production must also be served by an ASGI server.
- **Inconsistent data to fix first.**
  - The version's JSON lists (§1) duplicate the review and playlist records.
  - Comments and annotations do not name their version (§4).
  - Share settings promise behaviour that does not exist (§5).
  - Anything built on these would inherit the problems.
- **The frontend is ahead of the backend in places.** The player, drawing and compare screens exist (phases 31 to 33). The backend only stores what they save.

## 8. Draft phases (to be fixed after §9 is answered)

| Phase | Content | Depends on | Needs |
|---|---|---|---|
| RP-1 | **Data model cleanup.** The version's `reviews`, `playlists`, `notes_list`, `media_items` and `activity` come from records (read-through first, columns dropped in a later contract step, as in production P12). Comments and annotations name the version they are on. | none | migrations; API contract entries |
| RP-2 | **Notes.** One note model with replies, links to several records and an optional task; review comments become notes or stay as they are (Q-RP-4). | RP-1 | migrations, API contracts |
| RP-3 | **Approval roll-up and automations.** A `StatusChanged` handler: version approved means task approved, when the project's rule says so. Optionally a small engine for `AutomationRule`. | RP-1 | Q-RP-5 |
| RP-4 | **Publishing depth.** `PublishedFileDependency` (upstream and downstream, cycle check); a loader route (latest or approved publish of a type for a shot, asset or task); path and naming templates per project and file type. | none | migrations, API contracts |
| RP-5 | **Media pipeline.** Upload; Celery tasks with ffmpeg for a web proxy, thumbnail and filmstrip; frame-range probe; switched by the existing flags. | none | Q-RP-6 (image, storage) |
| RP-6 | **Notifications.** In-app (and optionally e-mail) on a note, mention, assignment or verdict. | RP-2 | Q-RP-7 |
| RP-7 | **Share links for outside reviewers.** Hashed one-time-shown token, expiry, revocation, rate limit, access trail, passcode (SEC-DLV-06). | RP-1, RP-5 | **ADR**, Q-RP-8 |
| RP-8 | **Live review.** Synced playback, frame and drawing broadcast over Channels, with presence. | RP-1, RP-5 | Q-RP-9 (Redis channel layer, ASGI in production) |
| RP-9 | **DCC and desktop integrations.** A Python API client and publish and load tools for named DCCs; RV or cineSync hand-off. | RP-4, RP-5 | Q-RP-10; likely its own repository |

Every phase follows the earlier programmes:
- its own branch;
- contracts in `docs/review-pipeline/CONTRACTS.md`, and ADRs where the trust model changes;
- tests against the pytest test database, with mutation checks;
- a frontend follow-up, served from captured responses;
- a verification report;
- a stop after each phase.

## 9. Decisions for the owner

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-1 | Keep ShotGrid's split (Version for review, PublishedFile for files) or ftrack's single AssetVersion with components? | A split; B merge | **A**: already built and enforced; a merge would be a large migration with no gain |
| Q-RP-2 | Reverse delivery-pipeline Q5/Q6 (ShotGrid-style features, dependencies, notifications in LATER) for this programme? | A yes, for the items in §8; B only some | **A**, recorded as the new answer |
| Q-RP-3 | Phase order | A as in §8; B another order | **A**: RP-1 first, because the other phases build on clean records |
| Q-RP-4 | Notes: one model for project and review notes, or keep review comments separate and only add replies and links to project notes? | A one model; B keep both | **B** for RP-2 (less migration risk); merge later if wanted |
| Q-RP-5 | Approval roll-up: fixed rule (version approved means task approved) or the configurable `AutomationRule` engine? | A fixed rule, on per project; B engine | **A** first; B only if studios need their own rules |
| Q-RP-6 | Media processing: ffmpeg in the Django or worker image, results written where? | A ffmpeg in the worker image, results on a storage root; B object storage (S3-compatible); C external service | **A** for now; B if the deployment has object storage |
| Q-RP-7 | Notifications: in-app only, or in-app and e-mail? | A in-app; B both | **A** first (no new outward channel) |
| Q-RP-8 | Account-free share links for clients at all? | A yes, behind an ADR and SEC-DLV-06; B no, clients use accounts (already works) | Your call: B keeps the trust model as it is; A matches ShotGrid and ftrack |
| Q-RP-9 | Live review in scope? | A yes (Channels, Redis channel layer, ASGI server in production); B later | **B** unless remote dailies are a priority |
| Q-RP-10 | DCC and desktop integrations: in this repository, a separate repository, or not at all? | A here; B separate; C no | **B**: a different runtime (inside Maya, Nuke, Houdini) and release cycle |

Nothing is built until these are answered. RP-1 can start as soon as Q-RP-1 to Q-RP-3 are answered.

**Answered 2026-11-12:** every recommendation is taken, and Q-RP-8 is **B** (no share links, so RP-7 is dropped). See [DECISIONS.md](DECISIONS.md) and [PLAN.md](PLAN.md).
