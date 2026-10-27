# Delivery pipeline: cross-app decisions

Covers decisions that span `apps.publishing`, `apps.deliveries` and `apps.scheduling` (and their edges to Production, Identity and Masterdata). Per-app decisions live in `docs/<app>/DECISIONS.md`. Questions are numbered once across all apps and phases (Q1, Q2, ...); an answered question is never asked again.

Status: **ANSWERED** (owner's written answer), **ASSUMED** (owner said "your call"; the recommendation was adopted), **OPEN**, **DEFERRED**.

| Q | Question | Answer | Date | Status | Affects |
|---|---|---|---|---|---|
| Q1 | What is "a publish"? | **A.** `production.Version` stays the published record (numbering, publish action, freeze, hero: production D-29). Publishing owns the *files* of a published version (path, SHA-256, size, file type from Masterdata) and their lifecycle, plus the existing DCC export jobs. No second numbering. | 2026-10-27 | ASSUMED | Phases 3-5 (publishing model), Phase 6 (what a delivery item references) |
| Q2 | Production imports Deliveries and Scheduling | **A.** Fix it: move `PlatformCrudViewSet` / `PlatformReadViewSet` to `apps/core`; Production reads delivery and schedule figures through a provider registered by Deliveries / Scheduling at app load; URLs and response shapes unchanged. Done in each app's first implementation phase (touches Production files). | 2026-10-27 | ASSUMED | Phase 3 (base class move), Phase 6 (deliveries provider), Phase 9 (scheduling provider) |
| Q3 | Storage model | **A now, C later.** Register-only: StudioHub stores a path under a named storage root plus checksum and size, never the bytes. Object storage only for client packages, and only if Q4 changes. | 2026-10-27 | ASSUMED | Phase 3 (path rules, storage roots), Phase 7 (no download links) |
| Q4 | How deliveries reach clients | **A.** Tracking only: the transfer happens outside StudioHub (Aspera, SFTP, ...); StudioHub records what was sent, when, by whom and the client's answer. No public download links. The plain-text `passcode` is fixed regardless. | 2026-10-27 | ASSUMED | Phase 7 (links section shrinks to the passcode fix and an audit trail) |
| Q5 | Scope now vs later | As in the Phase 0 table (recorded per app in each `DECISIONS.md`). | 2026-10-27 | ASSUMED | All implementation phases |
| Q6 | ShotGrid-style features not wanted | Everything in the LATER and NOT columns of Q5 is out of scope until asked for. | 2026-10-27 | ASSUMED | All implementation phases |
| Q7 | Implementation order | Publishing, then Deliveries, then Scheduling. | 2026-10-27 | ASSUMED | Branch order |
| Q8 | Roles | **A.** Reuse the seeded roles (platform-admin, org-admin, org-member, production-admin, vfx-supervisor, lead-artist, artist). No new roles. | 2026-10-27 | ASSUMED | Phases 5, 8, 11 (role-to-code matrices) |
| Q9 | Quality gates | **A.** No new `ruff format` or `basedpyright` violations in changed files; `ruff check`, `manage.py check`, `makemigrations --check` stay clean; mypy not used (not configured in the repo). Phase 0 baseline: format 455 files, basedpyright 228 errors. | 2026-10-27 | ASSUMED | Every gate |
| Q10 | Disposable database for migration round-trips | **A per phase** (round-trip the app's own migrations inside the pytest test database, ending at the latest state) **plus B for Phase 12** (a disposable database the owner provides). | 2026-10-27 | ASSUMED | Every implementation phase, Phase 12 |
| Q11 | Scoping | **A.** Project-scoped records follow project membership as in Production, read through Production's public selectors; platform-admin sees all. Destinations, resources, holidays and calendars are studio-wide. No organization FKs. | 2026-10-27 | ASSUMED | Phases 5, 8, 11 |
| Q12 | Where decisions are recorded | Yes: `docs/{publishing,deliveries,scheduling,delivery-pipeline}/DECISIONS.md` created in Phase 1, docs only. | 2026-10-27 | ASSUMED | This file |

## Phase 1 questions (answered at the Phase 1 gate, owner: "Your Call And Approved")

Options and trade-offs: each app's `ANALYSIS.md` §9/§10 and `docs/delivery-pipeline/ANALYSIS.md` §9. Per-app rows are repeated in each app's `DECISIONS.md`.

| Q | Question | Answer | Date | Status | Affects |
|---|---|---|---|---|---|
| Q13 | Fate of `PublishItem` | **A.** Kept as the export-job record, linked to the version it produced. | 2026-10-27 | ASSUMED | DOM-PUB-05; Phase 3 |
| Q14 | Simulated validation | **A.** Honest checks; `not_checked` instead of passed. | 2026-10-27 | ASSUMED | DOM-PUB-05; Phase 4 |
| Q15 | `Validated` reads "Published" | **A.** Words kept now; `job_status` added in Phase 5; label change with a frontend release. | 2026-10-27 | ASSUMED | API-PUB-08 |
| Q16 | Internal approval and client answer | **A.** Both; internal sign-off with separation of duties, client's answer as its own step. | 2026-10-27 | ASSUMED | DOM-DLV-02, DOM-DLV-07 |
| Q17 | Passcode | **A.** Encrypted, shown only with `delivery.view_secret`, audited. (B stays possible if you confirm nobody uses it.) | 2026-10-27 | ASSUMED | DOM-DLV-09 |
| Q18 | Frontend body keys | **A.** Both spellings accepted. | 2026-10-27 | ASSUMED | API-DLV-11 to 13, API-SCH-04 |
| Q19 | Leave for others | **A.** Own leave with `schedule.create`; others with `schedule.manage`. | 2026-10-27 | ASSUMED | DOM-SCH-05 |
| Q20 | Leave days | **A.** Working days once calendars exist (new requests). | 2026-10-27 | ASSUMED | DOM-SCH-05 |
| Q21 | Holiday calendars | **A.** Studio default plus per-office work calendars. | 2026-10-27 | ASSUMED | DOM-SCH-01, 02 |
| Q22 | Invented project milestones | **A.** Real milestones, same shape, empty list when none. | 2026-10-27 | ASSUMED | DOM-SCH-06, API-SCH-11 |
| Q23 | Audit target types | **A.** `publishing`, `delivery`, `scheduling` added (choices-only migration in `apps/audit`). | 2026-10-27 | ASSUMED | X-09; Phase 3 |
| Q24 | History-destroying on-delete rules | **A.** `PROTECT` (Django-level, no SQL) in each app's first phase. | 2026-10-27 | ASSUMED | Phases 3, 6, 9 |

## Phase 2 questions (answered at the Phase 2 gate, owner: "Your call and approved", 2026-10-27)

**Q25-Q38: all take the recommended option (A), status ASSUMED, 2026-10-27.** Q37 uses N = 3 years, command not scheduled. Q32 falls back to its option B if check 1 below shows the database role cannot create `btree_gist`. The questions and options stay below as the record of what was chosen between.

The design in the `CONTRACTS.md` / `PLAN.md` files follows each recommendation; answering otherwise changes the contracts named. None blocks writing the design; each blocks the phase named.

**Q25. Storage model and checksum source of truth.** Why: Q3 chose register-only; this fixes where checksums live and whether the server ever reads files.
* **A. `PublishedFile.sha256` is the single source of truth, declared by the publisher; verified by a background task only for roots mounted on the app server through a settings map** (`PUBLISHING_STORAGE_MOUNTS`, never a DB column). Sequence digest as in DOM-PUB-04. Trade-off: unmounted roots stay `declared` (trust in the pipeline tool).
* B. Declared only, never verified. Simpler; a wrong checksum is never detected by StudioHub.
* C. Server must verify before a file counts as registered. Strongest; needs every root mounted on the app server and slow registration for large sequences.
Recommendation and default: **A**. Blocks: Phase 3. Affects DOM-PUB-01, DOM-PUB-04.

**Q26. Immutability and corrections.** Why: what happens when a wrong file was registered or a wrong delivery sent.
* **A. Registered files and sent deliveries are immutable; corrections are new records**: revoke the file and register another path (or publish a new version); for deliveries, `revise` creates a new delivery linked by `revision_of`. A path once registered is never reused, even after revoke.
* B. Allow an "adjustment record" that amends a registered file or sent delivery in place, with history. Fewer records; history must be read to know what was true when.
* C. Allow re-registering a revoked path. Convenient for re-renders to the same path; breaks "a path names one content".
Recommendation and default: **A**. Blocks: Phases 3, 6. Affects DOM-PUB-02, DOM-DLV-05.

**Q27. Transition maps and refused moves.** Why: the brief wants one map per entity with guarded meaningful states; the status code and the frontend breakage need your choice.
* **A. One map per entity in one file per app (`constants/workflow.py`), guarded states: file Revoked; job Exported/Cancelled; delivery Signed Off, Submitted, Approved, Rejected, Complete, Cancelled; milestone Completed. A refused move, including the loser of a race, is 409 `invalid_transition`.** Audited override codes `publishing.status.override`, `delivery.status.override`, seeded to no role. Bulk uses the same map.
* B. Same maps, but 400 `invalid_transition` as Production does (D-03/D-08). Consistent with Production; a 400 does not tell a client "retry after reloading".
Frontend flows that assumed free movement (read, not run): the deliveries card's **Submit on Ready** (`DeliveryCard.tsx:221-231`) will get 409 until someone signs off (needs a new button); retry outside Validating; cancel after sending. Publishing: validate/unpublish on final jobs. Details: `docs/deliveries/PLAN.md` §5.
Recommendation and default: **A**. Blocks: Phases 4, 7.

**Q28. Separation of duties.** Why: decides who may sign off and whether sending also needs a second person.
* **A. Delivery sign-off only: whoever created, filled or prepared a delivery cannot sign it off, on every path (single action, history-based so reassigning does not help, tokens act as their owner; no bulk sign-off). Override `delivery.sod.override` + reason, seeded to no role. Leave keeps D-20 and gains `schedule.sod.override` (no role). Publishing has no approval step of its own (version approval is Production's, D-04 already).**
* B. A plus "sender must differ from signer". Stronger; needs three people per delivery in small teams.
* C. No separation in Deliveries. Simplest; the audit found the creator approving their own delivery (DLV-04).
Recommendation and default: **A**. Blocks: Phase 7.

**Q29. Delivery snapshot and revocation after sending.** Why: what a delivery records and what a later revoke does.
* **A. Snapshot from the server (version + registered files), refreshed until send, frozen at send. Only published versions with at least one Registered file without a checksum problem qualify. A revoke after sending leaves the delivery unchanged and flags `has_revoked_content`; before sending it invalidates QC and moves Signed Off back to Prepared.**
* B. As A, but versions without registered files qualify (snapshot from `Version.file_path`). Lets old versions be delivered at once; the snapshot then has no checksum.
* C. A revoke after sending also marks the delivery "Recalled" (new state) for follow-up.
Recommendation and default: **A**. Blocks: Phase 6. Affects DOM-DLV-03, 05, 08.

**Q30. Download links and notifications.** Why: the brief asks for both; Q4 already ruled out links.
* **A. No links (Q4). Notifications: none in these phases; every event that would notify is an `AuditLog` row, and a notification channel is LATER (Q5).** If links are ever added, SEC-DLV-06 lists the rules (hashed one-time-shown token, expiry, revocation, rate limit, download trail) and an ADR is required.
* B. E-mail notifications now through the existing `EmailService` and Celery, with retries, to the delivery's creator and signers on sign-off needed / sent / client answer; messages carry codes and links to the app only, no passcodes.
Recommendation and default: **A**. Blocks: Phase 7.

**Q31. Time zones, dates and calendars.** Why: capacity, leave and holidays depend on it.
* **A. Moments in UTC; days in the calendar's zone; weeks computed in the calendar's zone; naive date-times refused (400); working-day logic in `apps/scheduling/domain/calendar.py`; capacity = working days × hours per day, capped by the resource's weekly hours.** (CONTRACTS §1.)
* B. As A, but naive date-times taken as UTC (today's behaviour). Lenient; wrong for any studio away from UTC.
* C. As A, but naive date-times taken in the resource's calendar zone. Friendly for forms; ambiguous during DST changes.
Recommendation and default: **A**. Blocks: Phase 9.

**Q32. Booking overlap and over-allocation.** Why: D-22 allowed overlaps; the brief proposes blocking them.
* **A. Overlap of Booked/Blocked slots for one resource refused: service check under a resource lock (portable, SQLite too) plus a PostgreSQL exclusion constraint (`btree_gist`). Over-allocation beyond weekly capacity stays allowed and reported (D-09).** Supersedes the overlap part of D-22.
* B. Service check only. No extension needed; a write that bypasses the service (admin, raw SQL) can still overlap.
* C. Keep D-22 (overlaps allowed, reported).
Recommendation and default: **A**, falling back to B if the database role cannot create `btree_gist` (check 1 below). Blocks: Phase 10.

**Q33. Stored values that should be derived.** Why: the brief forbids drops without written approval.
* **A. Stage 1 (these phases): stop writing, make read-only, derive in selectors: `PublishItem.is_archived`, `DeliveryPackage.is_archived`, `total_size_bytes`, `total_frames`, `delivery_destination` (replaced by a destination FK), `Resource.status` "On Leave", `DeliveryVersionRef.is_validated`. Stage 2 (a later phase, only with your written approval): a separate reversible drop migration preceded by a CSV export of the columns.** Masterdata's utilization columns are Masterdata's to drop.
* B. Keep writing the stored columns in parallel (dual-write) until a drop. More code, two sources of truth meanwhile.
Recommendation and default: **A**. Blocks: Phases 3, 6, 10.

**Q34. Permission codes and role matrix.** Why: new actions need codes; least privilege changes some grants.
* **A. The matrices in `docs/publishing/PLAN.md` §6, `docs/deliveries/PLAN.md` §6, `docs/scheduling/PLAN.md` §6.** New codes: `publishing.deprecate`, `publishing.revoke`, `publishing.storage.manage`, `publishing.status.override`; `delivery.approve`, `delivery.send`, `delivery.view_secret`, `delivery.status.override`, `delivery.sod.override`; `schedule.manage`, `schedule.approve`, `schedule.sod.override`. Override codes seeded to no role. **Grants removed:** vfx-supervisor loses `publishing.delete` and `delivery.delete`. **Grants added:** lead-artist `publishing.create`; lead-artist and artist `schedule.create` (own leave and events only). A matrix test pins seeded = enforced. Roles: the seeded seven (Q8); no delivery-manager or coordinator role.
* B. As A without removing any existing grant. No one loses anything; less least privilege.
* C. Add a "coordinator" role (bookings, leave for others, deliveries without sign-off). Matches studio practice; a new role contradicts Q8.
Recommendation and default: **A**. Blocks: Phases 5, 8, 11.

**Q35. Sensitive fields and their gates.**

| Field | Gate (recommended) |
|---|---|
| `DeliveryPackage.passcode` | encrypted; `delivery.view_secret`; audited reads; never searchable |
| `DeliveryPackage.notes` (internal) | `delivery.view` members (unchanged); not shown in any client-facing view |
| `PublishedFile.revoke_reason` | `publishing.revoke` holders and the registrant |
| `Resource.hourly_rate_usd`, user e-mail | `schedule.view_rates` (D-21); ordering closed |
| `ResourceLeave.reason`, `rejection_reason` | the person and approvers (D-20); search closed |
| `ResourceSchedule.notes` out of scope | masked (D-21); search closed |
| Client contract value / contacts | not copied into deliveries; read in Masterdata with `masterdata.client.view_financial` |

Encryption key for the passcode:
* **A. A dedicated `DELIVERY_SECRET_KEY`; the MultiFernet helper moves from `apps/identity/crypto.py` to core with the key name as a parameter (identity keeps a wrapper).** Separate keys limit what one leaked key exposes.
* B. Reuse `MFA_ENCRYPTION_KEY`. No new key to manage; one key protects two unrelated secrets.
Recommendation and default: **A**. Blocks: Phase 7.

**Q36. Bulk endpoint contract.**
* **A. As Production D-08: 1-100 distinct ids; each item its own transaction (partial success); 200 when all succeed, 207 otherwise; `results[]` of `id`, `ok`, `error` (`null`, `not_found`, `invalid_transition`, `forbidden_field`, ...); invisible, forbidden and unknown items report the identical `not_found`; same transition map, never an override.** Bulk endpoints planned: `publishing/files/bulk-register/`, `deliveries/bulk-cancel/`, `scheduling/schedules/bulk-delete/`. No bulk sign-off, send or leave decision.
* B. All-or-nothing (one transaction, 400 on the first failure). Simpler for clients; one bad id fails the batch.
Recommendation and default: **A**. Blocks: Phases 3, 8, 11.

**Q37. Retention and cleanup.**
* **A. Nothing is deleted automatically. Expired links: none exist (Q4). Orphan files: StudioHub never deletes files; the verification task flags registered paths that disappeared (`missing`), report only. DCC export jobs, deliveries, QC and history kept. Leave reasons: a management command `redact_leave_reasons --older-than-years N` (dry run by default) blanks reason texts of decided leave older than N years, keeping the rows.** You choose N (suggest 3) or "never".
* B. Also purge Cancelled export jobs and Cancelled draft deliveries older than N months (soft delete).
Recommendation and default: **A**, N = 3, command not scheduled (run by hand). Blocks: Phase 11.

**Q38. Compatibility.**
* **A. No permission code is renamed (only added), so no aliases. Deprecated request fields and the old integer item id keep working for one minor release and are removed in the next major (v4.0.0); deprecated stored fields are read-only (a different value is a 400, an echo is fine, production D-01). Old body spellings (Q18) stay indefinitely. Management-command flags that become meaningless print a warning on stderr and do nothing until v4.0.0.** The re-export of the moved viewset base is removed in Phase 12.
* B. Remove deprecated inputs at once. Cleaner; breaks unknown external callers.
Recommendation and default: **A**. Blocks: Phases 5, 8, 11.

## While implementing (recorded as they happen)

| ID | Date | What | Status | Affects |
|---|---|---|---|---|
| A-1 | 2026-10-27 | **The repository has no Celery app** (`config/celery.py` and `config/__init__.py` are empty; broker settings exist, nothing calls `.delay()`), contrary to the Phase 0 note "Celery with Redis (eager in tests)". Publishing checksum verification therefore ships as `manage.py verify_published_files`, not a queued task. Q30 option B (e-mail notifications through Celery) would need an app wired first, which is new architecture: ask before doing it. | ASSUMED (follows Q25 A: verification stays optional) | Phase 3; Q30 |
| A-2 | 2026-10-27 | Job create checks that the project exists (unknown is a 400, was a 500) but not membership; membership, required project and list scoping are Phase 5. Files are scoped by membership from the start. | ASSUMED | Phase 3 to 5 |
| A-3 | 2026-10-27 | New permission codes are seeded in Phase 3 (the endpoints need them); the grant *removals and additions* of Q34 stay in Phase 5. `publishing.storage.manage` goes to org-admin and platform-admin only; `deprecate` and `revoke` to the full production roles. | ASSUMED | Phase 5 |
| A-4 | 2026-10-27 | `AuditLog` target `delivery` already existed (Q23 mentioned adding it); only `publishing` and `scheduling` were added. | n/a | Phase 6 uses the existing one |
| A-5 | 2026-10-27 | A 409 `path_already_registered` tells a member that a path is taken even if the other file belongs to a project they cannot see (storage paths are studio-wide and the unique constraint spans projects). It reveals existence only: no version, project, size or checksum. | ACCEPTED RISK (low) | Phase 5 review |
| A-6 | 2026-10-27 | `PublishItem.is_archived` is still read (old rows that were archived keep reading "Unpublished") but nothing writes it. | ASSUMED (Q33 A, stage 1) | Phase 4 |

### Phase 4

| ID | Date | What | Status | Affects |
|---|---|---|---|---|
| A-7 | 2026-10-27 | Leaving a guarded job state (Exported, Cancelled) is a service call with `publishing.status.override` and a reason; no endpoint. Republishing is the normal way to run a finished job again. | ASSUMED | Phase 5 |
| A-8 | 2026-10-27 | `republish` works from a job in any status: it creates a new job and changes nothing on the old one, so the brief's "guard meaningful states only" gives no reason to restrict it. | ASSUMED | |
| A-9 | 2026-10-27 | Rules that need the artist's machine or a mounted disk are reported `not_checked`, and a job still validates when only `not_checked` rules remain (otherwise nothing could validate). `dependencies` and `permissions` rules are always `not_checked` (dependencies are Later, Q5). | ASSUMED (Q14 A) | Phase 5 |

**Q39 (OPEN, non-blocking). Who moves an export job to Exporting, Exported or Failed-during-export?**
The map has these states (they existed in the model) but no endpoint reaches them: validation only produces Validated or Failed, and the DCC tool has no way to report that an export started or finished. Why it matters: today a job can never become Exported through the API, so the "Published" word the UI shows comes from Validated.
* **A. Leave it (assumed for now).** Nothing changes; the states stay reachable only through `JobService.move`.
* B. Add `POST /{id}/start-export/`, `/complete-export/` and `/fail/` (code `publishing.update`, project-scoped from Phase 5), so a pipeline tool can report progress; `complete-export` could record the files the job produced.
* C. Remove Exporting and Exported from the map until a tool needs them.
Recommendation: **B**, but only once you know which tool reports the export; until then **A**. Default if "your call": **A**. Blocks: nothing.

## Checks only you can make

1. **`btree_gist`** (Q32): on the production database, as the application role, does `CREATE EXTENSION IF NOT EXISTS btree_gist;` succeed (or is it already installed: `SELECT extname FROM pg_extension;`)? It is a trusted extension since PostgreSQL 13, so a role with `CREATE` on the database can install it.
2. Pipeline or DCC tools calling `/api/v1/publishing/` or `/api/v1/deliveries/` (ANALYSIS §10).
3. Whether the delivery passcode is used outside StudioHub (Q17).
4. Storage roots and whether any is mounted on the app server (Q25).
5. Offices, their time zones and holidays (Q21, Q31).
6. The staging counts of `docs/delivery-pipeline/ANALYSIS.md` §8 (decide whether the stop-and-list migrations will stop).

## Standing assumptions

* Full test suite at every gate (about 23 minutes; Phase 0 baseline 4340 passed, 1 skipped).
* `../studiohub-react` (`main` @ `0209812`) is the current frontend. It is read, never run or changed.
* **Brief vs Q5:** the brief's Phase 4 (publish dependencies) and Phase 9 (schedule dependencies) items are not built, because Q5 put dependencies in LATER. Reversing that is a new answer, not a re-ask.
* **Branch bases:** `feature/deliveries-improvement` starts from `develop` if the publishing branch has been merged by the owner, otherwise from the last publishing commit (`docs/deliveries/PLAN.md`). Scheduling starts from `develop`. The Phase 12 commit's branch is asked at the Phase 11 gate.
