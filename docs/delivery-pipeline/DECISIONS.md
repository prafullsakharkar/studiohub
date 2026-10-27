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

### Phase 4 and after

| ID | Date | What | Status | Affects |
|---|---|---|---|---|
| A-7 | 2026-10-27 | Leaving a guarded job state (Exported, Cancelled) is a service call with `publishing.status.override` and a reason; no endpoint. Republishing is the normal way to run a finished job again. | ASSUMED | Phase 5 |
| A-8 | 2026-10-27 | `republish` works from a job in any status: it creates a new job and changes nothing on the old one, so the brief's "guard meaningful states only" gives no reason to restrict it. | ASSUMED | |
| A-9 | 2026-10-27 | Rules that need the artist's machine or a mounted disk are reported `not_checked`, and a job still validates when only `not_checked` rules remain (otherwise nothing could validate). `dependencies` and `permissions` rules are always `not_checked` (dependencies are Later, Q5). | ASSUMED (Q14 A) | Phase 5 |
| A-10 | 2026-10-27 | `complete-export` (Q39 B, Phase 5) does not require a registered file; validation reports a missing one. | ASSUMED | Phase 5 |
| A-11 | 2026-10-27 | Old export jobs that name no project are visible to platform admins only (nobody else is a member of "no project"). | ASSUMED | Phase 5 |
| A-12 | 2026-10-27 | `create_job` called without a request (internal callers, tests) is trusted: any existing project is accepted. Every API call passes its request, so membership is always checked there. | ASSUMED | |
| A-13 | 2026-10-27 | The admin for export jobs is view-only; validation rules and destinations stay editable (rules have no API). | ASSUMED | Phase 5 |
| A-14 | 2026-10-27 | Signed-URL expiry does not apply (Q3/Q4: no files are served and no links exist); "a disabled user loses access" is tested across the three apps in Phase 12. **Done:** `apps/core/tests/integration/test_disabled_user_three_apps.py`. | ASSUMED (done) | Phase 12 |
| A-15 | 2026-10-27 | `PATCH`/`PUT /deliveries/{id}/` are built in Phase 6, not later: the plan gave them (DLV-08) to no phase and the item rules need one edit path. | ASSUMED | `DeliveryService.update`, `tests/api/test_core_api.py` |
| A-16 | 2026-10-27 | Create accepts any existing project and client (existence only). Project membership scoping and destination constraints stay Phase 8, like publishing's A-2. | ASSUMED | Phase 8 |
| A-17 | 2026-10-27 | The passcode is no longer returned by any endpoint (`has_passcode` instead) and is out of the admin, but it is still stored in plain text until Phase 7 (encryption, `delivery.view_secret`). | ASSUMED | `api/serializers/delivery.py`, Phase 7 |
| A-18 | 2026-10-27 | Send works from Prepared only and only while `sent_at` is empty. The old `retry` can set the status back to Prepared, but `sent_at` keeps the delivery closed: not editable, not sendable again. | ASSUMED | `DeliveryService.send`, `test_prepare_and_send.py` |
| A-19 | 2026-10-27 | The stored totals columns are no longer written. Responses derive size and frames from the item snapshots. Old rows keep their stored values. | ASSUMED | `derived_totals` |
| A-20 | 2026-10-27 | A failed QC on `prepare` or `send` commits the run's rows and the refreshed snapshot, then raises the 409. A refused attempt stays on record. | ASSUMED | `DeliveryService.prepare/send` |
| A-21 | 2026-10-27 | Legacy items (typed snapshot, no item files) cannot pass QC until their version has registered files. They are not migrated or invented. | ASSUMED | `0005`, `qc.py` |
| A-22 | 2026-10-27 | The test database had a hard limit: PostgreSQL keeps dropped columns forever, 1600 per table, and `production_review` in `test_studiohub` had reached 1596 (1573 dropped) from repeated runs of the production migration tests, so three tests in `apps/production/tests/test_migrations_hierarchy.py` failed with `tables can have at most 1600 columns`. **Resolved 2026-10-27 with your approval:** every table, sequence and the `btree_gist` extension in `test_studiohub` (all owned by the connecting role; the role is not the database owner, so the schema itself could not be dropped) were dropped, and the next pytest run migrated it from empty. The whole `test_migrations_hierarchy.py` file then passed (23). It will fill up again with use: the deliveries migration tests reverse only what they must (`deliveries_package` is the table at risk). | ANSWERED (done) | Phase 6 gate |
| A-23 | 2026-10-27 | Phase 7 sends only from **Signed Off**. A delivery already in Prepared when this ships needs a sign-off before it can be sent; there is no bypass. | ASSUMED | `DeliveryService.send` |
| A-24 | 2026-10-27 | The passcode is read at `GET /deliveries/{id}/passcode/` (code `delivery.view_secret`, project access, audited, `Cache-Control: no-store`), not as a field of the detail. Reading it on every detail view would write one audit row per page view. | ASSUMED (differs from CONTRACTS API-DLV-01) | `api/viewsets/delivery.py` |
| A-25 | 2026-10-27 | `DELIVERY_SECRET_KEY` is its own key, not MFA's (Q35 offered both). The Fernet mechanics moved to `apps/core/security/fernet.py`; `identity/crypto.py` keeps its public names and behaviour. | ASSUMED | `apps/core/security/fernet.py` |
| A-26 | 2026-10-27 | Migration 0009 refuses (nothing changed, a count and never a value) when passcodes exist and no key is set. Operators set `DELIVERY_SECRET_KEY` first. | ASSUMED | `0009_encrypt_passcode.py` |
| A-27 | 2026-10-27 | Sign-off and send both run QC; send does not refresh the snapshot (it sends what was signed). A file registered, deprecated or revoked after sign-off fails `snapshot_current`, the delivery stays Signed Off and someone reopens, prepares and signs again. This replaces Phase 6's "last look picks up late files". | ASSUMED | `DeliveryService.send`, `test_prepare_and_send.py` |
| A-28 | 2026-10-27 | The status override is service-only (`DeliveryService.override_status`), like publishing's A-7: no endpoint. The ordinary actions never ask for it, so cancelling or completing a sent delivery is the map's plain 409. | ASSUMED | `transitions.move` |
| A-29 | 2026-10-27 | Separation of duties counts the creator, the adder of each current item and whoever moved the delivery into Prepared (a reopen from Signed Off is not preparing). The adder of an item that was later removed is no longer known. Existing deliveries get a creation row in the history from `created_by` (0008); their earlier moves are not known. | ASSUMED | `services/duties.py`, `0008_workflow.py` |
| A-30 | 2026-10-27 | `revise` copies name, project, client, method, destination, due date and internal notes, and the versions that are still deliverable; it does not copy the passcode. Versions that are not deliverable any more are returned as `skipped_versions`, not dropped silently. One live (not cancelled) revision per rejected delivery. | ASSUMED | `DeliveryService.revise` |
| A-31 | 2026-10-27 | The new codes (`delivery.approve`, `delivery.send`, `delivery.view_secret`, `delivery.status.override`, `delivery.sod.override`) are in the permission catalog but **held by no role until Phase 8's role seeding**. Until then only superusers (and the test grants) can sign off, send or answer; the two override codes are held by nobody. | ASSUMED | `init_platform.py`, Phase 8 |
| A-32 | 2026-10-27 | Notifications and domain events for the workflow are not built (Q5 puts them in LATER). The one event handler is Publishing's `PublishedFileRevoked`. | ASSUMED | Q5 |
| A-33 | 2026-10-27 | Phase 6 tests that asserted free movement (approve/reject from Draft, complete from Draft, retry resetting to Prepared, send from Prepared, late files picked up at send) now start from the state the map requires; their assertions about what the endpoint answers are unchanged. Retry's old "reset to Prepared" is replaced by "re-run QC while Validating" (CONTRACTS DOM-DLV-02). | ASSUMED | `tests/test_api.py` |
| A-34 | 2026-10-27 | Q33 said to make `delivery_destination` read-only at once. The frontend only sends that text (`RESTDeliveryAdapter.ts`), so it stays writable while no destination is chosen (Q38: deprecated request fields keep working for one minor release). With a destination chosen, a different text is a 400. | ASSUMED (differs from Q33 stage 1) | `DeliveryService._check_destination_text` |
| A-35 | 2026-10-27 | Create requires a project unless a platform admin sends a code (as publishing's A-2); a project may be named by id or code; an unknown, foreign or malformed one is the same "Unknown project." The client must be Active (blank status counts as Active) and the destination active. | ASSUMED | `DeliveryService.create` |
| A-36 | 2026-10-27 | Old deliveries that name no project are visible to platform admins only, like old export jobs (A-11). | ASSUMED | `DeliverySelector` |
| A-37 | 2026-10-27 | Destinations are studio-wide reference data: no project scoping, the existing codes (`view`, `create`, `update`, `delete`) gate them. A destination in use cannot be hard-deleted (PROTECT); a soft-deleted one frees its name. | ASSUMED | `DestinationViewSet` |
| A-38 | 2026-10-27 | In `bulk-cancel` a cancel the caller's codes do not allow (a signed-off delivery without `delivery.approve`) reports `not_found` like an unknown one (Q36: forbidden reports the identical `not_found`). | ASSUMED | `DeliveryViewSet.bulk_cancel` |
| A-39 | 2026-10-27 | The package, item, snapshot, QC, history and counter admins are view-only (as publishing's A-13). Destinations stay editable; saving a default in the admin moves it, as the API does. | ASSUMED | `admin/delivery.py` |
| A-40 | 2026-10-27 | The deliveries tests' `staff_user` is a platform admin (scoping would otherwise hide every delivery from it); the scoping tests build their own members. | ASSUMED | `tests/conftest.py` |
| A-41 | 2026-10-27 | `init_platform` only added role grants, so rerunning it never took `delivery.delete` / `publishing.delete` from the vfx-supervisor. **Resolved by Q40 = A (2026-10-27):** it now removes the codes in `WITHDRAWN_GRANTS` from the seeded system roles on every run (real deletes, so the permission cache is cleared). | ANSWERED (done) | `init_platform.py`, `apps/core/tests/test_init_platform_withdrawn.py` |
| A-42 | 2026-10-27 | The test key for delivery passcodes lives in the tracked `backend/.env.test` (pytest and CI load it: `DJANGO_ENV=testing`), not in `config/settings/testing.py`, and the tests use it. It is a throwaway value that protects nothing real. **A defect this exposed (Phase 7):** `config/settings/base.py` re-exports each setting by name and `DELIVERY_SECRET_KEYS` was missing from that list, so outside the tests (the old `testing.py` override hid it) `DELIVERY_SECRET_KEY` never reached Django and every passcode write or read would have been a 503. Fixed; a test now asserts `testing.py` defines no key and that the env supplies one valid key. | ANSWERED (user: "remove key from testing.py and commit .env.test and use it") | `config/settings/base.py`, `.env.test`, `test_passcode.py` |
| A-43 | 2026-10-27 | **Branch base (deviation from the plan).** `feature/scheduling-improvement` was created from the deliveries tip (`66649be`), not from `develop`, because `develop` lacks the publishing and deliveries work, the shared test database already holds those migrations, and Phase 11 edits the same files (`init_platform`, the role-matrix tests). Merge order is yours: publishing, deliveries, then scheduling. | ASSUMED | git history |
| A-44 | 2026-10-27 | **Calendar fallback.** If no default `WorkCalendar` row exists (a `transaction=True` test flushes the seeded one; so could a data loss), arithmetic uses built-in rules (UTC, Mon-Fri, 8h) and `WorkCalendarService.ensure_default()` recreates the default when a holiday is created without a calendar. Nothing 500s for want of a calendar. | ASSUMED | `selectors/calendar.py`, `services/calendar.py` |
| A-45 | 2026-10-27 | **Interim gates.** Until Phase 11 adds `schedule.manage`, calendar writes need `schedule.update` (delete: `schedule.delete`) and milestone writes need `schedule.create` / `update` / `delete`. Phase 11 tightens them; roles holding `schedule.update` can edit calendars in the meantime. | ASSUMED | `api/viewsets/__init__.py` |
| A-46 | 2026-10-27 | Leave overlap, own-request and the other leave rules are not touched in Phase 9 (Phase 11). | ASSUMED | DOM-SCH-05 |
| A-47 | 2026-10-27 | A leave covering no working day (a weekend, a holiday) is accepted and counts 0 days. | ASSUMED | `services/leave.py` |
| A-48 | 2026-10-27 | Reopening a Completed milestone goes to In Progress, and clears who and when it was completed. | ASSUMED | `services/milestone.py` |
| A-49 | 2026-10-27 | Calendars and milestones are view-only in the admin (the API is the way to change them). | ASSUMED | `admin/scheduling.py` |
| A-50 | 2026-10-27 | Create responses for events and resources now include `id` (they omitted it). Additive. | ASSUMED | `api/serializers/__init__.py` |
| A-51 | 2026-10-27 | **Superseded by A-57.** Phase 10 was first built with Q32 option B (service lock only) because I reported `btree_gist` as missing from the database server; that finding was about the wrong server (check 1 below). | SUPERSEDED | |
| A-52 | 2026-10-27 | A booking flagged Overbooked by triage still occupies its time, so it cannot be double-booked (the contract listed only Booked and Blocked). | ASSUMED | `services/booking.py` |
| A-53 | 2026-10-27 | **Capacity scaling.** Weekly capacity is multiplied by available days over usual working days (holidays and Approved leave remove days), rather than "working days times hours per day, capped by the weekly figure". The proposed wording would silently cut a resource with 45 weekly hours to 40 in every ordinary week. An ordinary week is unchanged. | ASSUMED (differs from the Phase 2 proposal) | `domain/calendar.py`, `selectors/capacity.py` |
| A-54 | 2026-10-27 | Only Approved leave reduces capacity or shows a resource as On Leave; Pending does not. | ASSUMED | selectors |
| A-55 | 2026-10-27 | Existing overlapping bookings are left alone and can still be edited (notes, event, task); only a change of resource, times or status is checked. The `?status=` filter on resources still reads the stored column. | ASSUMED | `services/booking.py` |
| A-56 | 2026-10-27 | Scheduling publishes `scheduling.project_milestones` and `scheduling.capacity` through `apps.core.providers`. Nothing reads the capacity provider yet (Masterdata's utilization is not part of this work). The project dashboard card keeps deriving its own milestone list. | ASSUMED | `apps/scheduling/providers.py` |
| A-57 | 2026-10-27 | **Q32 is option A.** Migration `0008_booking_exclusion` adds the exclusion constraint on top of the service lock (user: "Option 2, add the constraint and commit"). It reuses masterdata's `PostgresOnlyExclusionConstraint` and `EnsureBtreeGistExtension` (an allowed dependency: Scheduling depends on Masterdata). It stops and lists existing overlapping pairs first. Staging: run S1 first; the live database's extension is UNVERIFIED (check 1). | ANSWERED (user) | `migrations/0008_booking_exclusion.py` |
| A-58 | 2026-10-27 | **Scheduling write gates.** `schedule.manage` replaces the interim gates of Phase 9 (A-45) for calendars, holidays, milestones, bookings, and **also for creating resources** (it was `schedule.create`, which lead-artist and artist now hold). | ASSUMED | `apps/scheduling/api/viewsets` |
| A-59 | 2026-10-27 | Editing a pending leave needs `schedule.create` (own) or `schedule.manage`; no leave `cancel` endpoint is built. | ASSUMED | `services/leave.py` |
| A-60 | 2026-10-27 | Bookings and leave are searchable by resource name and code; notes and reasons never. | ASSUMED | SEC-SCH-01 |
| A-61 | 2026-10-27 | A leave override reason is stored in the audit row's metadata; leave overlap is held by the resource lock only (no database constraint). | ASSUMED | `services/leave.py` |
| A-62 | 2026-10-27 | Bookings and leave are view-only in the admin. | ASSUMED | `admin/scheduling.py` |
| A-63 | 2026-10-27 | Q37: N = 3 years for `redact_leave_reasons`, run by hand, never scheduled. | ASSUMED (Q37 default) | `redact_leave_reasons` |
| A-64 | 2026-10-27 | **Phase 12 branch.** The standing note said the Phase 12 branch would be asked at the Phase 11 gate; I did not ask. Phase 12 is committed on `feature/scheduling-improvement`, the tip that already contains the publishing and deliveries work, because it touches all three apps. Merge order is yours (publishing, deliveries, scheduling). | ASSUMED | git history |
| A-65 | 2026-10-27 | **Q10 B was not done.** No disposable database was provided for a forward, backward, forward round trip of the three apps' migrations; only the per-phase round trips inside the test database (Q10 A) were done. The commands for you are in `VERIFICATION.md`. | ASSUMED (UNVERIFIED) | migrations |
| A-66 | 2026-10-27 | **Selectors, not models (X-03, X-06).** Scheduling's serializers still queried Production's `Project` and Masterdata's `Department`, `Team` and `Office` models directly. They now go through `ProjectSelector`, `DepartmentSelector`, `TeamSelector` and `OfficeSelector`, and a test pins it for all three apps. Identity's `User` is still looked up directly, and the booking and event links use the relation's manager for `Task` (both accepted: no selector contract exists for them). | ASSUMED | `apps/core/tests/test_dependency_direction.py` |

**Q40 (ANSWERED 2026-10-27: A). Should `init_platform` also withdraw the grants Q34 removes?**

**Answer: A.** `init_platform` has a short `WITHDRAWN_GRANTS` list (system roles only: `vfx-supervisor` loses `publishing.delete`, `delivery.delete`, `delivery.send`, `delivery.view_secret`) and removes those grants on every run, with real deletes so the RBAC signals clear the holders' cached permissions. Rerunning the command makes any database match the matrix; an admin's own re-grant of those codes to that role is undone on the next run. The command prints how many it removed. Options not taken: B (additive, manual revoke) and C (a separate one-off command). Status: ANSWERED, A.

**Q41 (OPEN, non-blocking; default A used). Should archiving a shot with published work be refused?**

Found in Phase 12 while testing "archive a shot with versions, publishes and deliveries". Production's rule (D-13, D-29) refuses to archive or delete a **published version** and refuses to archive a sequence or episode that still has live children, but a **shot** can be archived freely and its versions stay live and published. Nothing is lost (the delivery, its files and its history stay readable, and restoring the shot brings it back), but a delivered version can end up belonging to an archived shot. Why it matters: the contract text I wrote first said this would be refused; it is not, and the rule lives in Production, which these three apps do not change.
* **A. Leave Production as it is (used).** Soft archive is reversible and history stays readable; no change to a module outside this work.
* B. Refuse to archive a shot (or an asset) while it has a published version: "Unpublish it first", like D-13. Consistent with the version rule; a Production change with its own tests, and it blocks the bulk archive for those shots.
* C. Also warn in the archive response which deliveries carry the shot's versions. Informative only.
Recommendation and default: **A** until someone asks for B. Blocks nothing. Status: ASSUMED (A).

**Q39 (ANSWERED 2026-10-27: B). Who moves an export job to Exporting, Exported or Failed-during-export?**

**Answer: B.** Add `start-export`, `complete-export` and `fail` actions so a pipeline tool can report progress. Built in Phase 5 (project-scoped from the start); the details are in `docs/publishing/PLAN.md` section 9. The question and options as asked:
The map has these states (they existed in the model) but no endpoint reaches them: validation only produces Validated or Failed, and the DCC tool has no way to report that an export started or finished. Why it matters: today a job can never become Exported through the API, so the "Published" word the UI shows comes from Validated.
* **A. Leave it (assumed for now).** Nothing changes; the states stay reachable only through `JobService.move`.
* B. Add `POST /{id}/start-export/`, `/complete-export/` and `/fail/` (code `publishing.update`, project-scoped from Phase 5), so a pipeline tool can report progress; `complete-export` could record the files the job produced.
* C. Remove Exporting and Exported from the map until a tool needs them.
Recommendation was **B** once the reporting tool is known; default **A**. Status: ANSWERED, B.

## Checks only you can make

1. **`btree_gist`** (Q32) **(CORRECTED 2026-10-27)**. An earlier entry here said the extension was not available. That was measured on the wrong server: a hand-run script with `DJANGO_ENV=testing` reads `.env.test`, which points at a PostgreSQL 17.11 server on port 5432 that the tests do not use (stale schema, no applied migrations). **Pytest runs against port 5439, PostgreSQL 18.6, with 144 migrations, and `btree_gist` is already installed there** (read from inside a pytest run). So the extension exists on the test cluster, and its contrib files are on that server. The **live database is UNVERIFIED**: it is believed to share that cluster's server (`.env.local`), so the extension is probably installable there, but nobody has checked. To check, as the application role on that database: `SELECT extname FROM pg_extension;` and `SELECT name FROM pg_available_extensions WHERE name = 'btree_gist';` (`docs/scheduling/BTREE_GIST.sql` does both, then installs). Phase 10 was first built with Q32 option B (A-51) on that wrong finding; the user then chose to add the constraint (A-57, migration 0008). Lesson: never read a database's state from a hand-run script; probe from inside pytest.
2. Pipeline or DCC tools calling `/api/v1/publishing/` or `/api/v1/deliveries/` (ANALYSIS §10).
3. Whether the delivery passcode is used outside StudioHub (Q17).
4. Storage roots and whether any is mounted on the app server (Q25).
5. Offices, their time zones and holidays (Q21, Q31). **Time zone ANSWERED 2026-10-27: `Asia/Kolkata`** (user: "option 2 asia/kolkata"). Not yet applied: the seeded "STUDIO" calendar is still UTC, so create or edit the calendar in each environment (`PATCH /api/v1/scheduling/calendars/{id}/` with `{"time_zone": "Asia/Kolkata"}`, or a new office calendar and `set-default/`). Holidays still to be supplied.
6. The staging counts of `docs/delivery-pipeline/ANALYSIS.md` §8 (decide whether the stop-and-list migrations will stop).
7. Before migrating deliveries 0010 on staging, count destination clashes (read-only):
   `SELECT upper(name), count(*) FROM deliveries_destination WHERE NOT is_deleted GROUP BY 1 HAVING count(*) > 1;` and `SELECT id, name FROM deliveries_destination WHERE is_default AND NOT is_deleted;` (more than one row means the migration will stop and list them).
8. Run `manage.py init_platform` on each environment and read its last line: it says how many withdrawn role grants it removed (Q40 = A). Afterwards the vfx-supervisor should hold none of `delivery.delete`, `delivery.send`, `delivery.view_secret`, `publishing.delete` (UNVERIFIED on your databases; check in the admin or with your own query).
9. Before migrating scheduling 0006 on staging, count the rows it will refuse (read-only, S2 of `ANALYSIS.md` §8): events with `end_time < start_time`, bookings with `end_time <= start_time`, leave with `end_date < start_date`, resources with `hourly_rate_usd < 0`, and `SELECT upper(code), count(*) FROM scheduling_resource GROUP BY 1 HAVING count(*) > 1;` (deleted rows count). Any row returned makes the migration stop and list it. Also `manage.py report_leave_days` shows how many existing leave rows would count differently as working days (it changes nothing; run it only against a database you mean to read).
10. Which office time zones the work calendars should use (Q21, Q31): until you create them every resource follows the UTC "STUDIO" calendar, so capacity weeks are UTC weeks.
11. **After deploying scheduling Phase 11, run `manage.py init_platform` on every environment.** The new codes `schedule.manage` and `schedule.approve` reach roles only when it runs; until then nobody but a superuser can approve leave, book a resource or create calendars, holidays and milestones. Afterwards check (UNVERIFIED on your databases): org-admin, production-admin and vfx-supervisor hold `schedule.manage` and `schedule.approve`; lead-artist and artist hold `schedule.create`; **no role holds `schedule.sod.override`**.
12. Decide whether to run `manage.py redact_leave_reasons` (Q37) and from when; it is a dry run unless `--apply`.
13. **Migration round trip on a disposable database (Q10 B, not done).** On an empty database you can throw away, with the environment pointing at it, run: `uv run python manage.py migrate`, then `migrate scheduling 0003_leave_rejected_by`, `migrate deliveries 0001_initial`, `migrate publishing 0001_initial`, then `migrate` again. I have not run this sequence on any database (UNVERIFIED); each app's own migrations were round-tripped one by one in the test database. Expect each step to finish without error, and the last `migrate` to end at the latest migration (`uv run python manage.py showmigrations scheduling deliveries publishing`). Never run this on a database that holds data you need: the backward steps drop columns and tables of those apps.
14. **The live database's `btree_gist`** (Q32): scheduling migration 0008 creates the extension if it is missing. Check first with the two queries in `docs/scheduling/BTREE_GIST.sql`, and count overlapping bookings with query S1 (`ANALYSIS.md` section 8); a pair makes the migration stop and list it.
15. **Q41:** say whether archiving a shot that has published work should be refused (default: no).

## Standing assumptions

* Full test suite at every gate (about 23 minutes at the start, about 35 now; Phase 0 baseline 4340 passed, 1 skipped). It was held back from Phase 4 to Phase 7 and again from Phase 10 to Phase 12 at the owner's request; Phase 12 ran it.
* `../studiohub-react` (`main` @ `0209812`) is the current frontend. It is read, never run or changed.
* **Brief vs Q5:** the brief's Phase 4 (publish dependencies) and Phase 9 (schedule dependencies) items are not built, because Q5 put dependencies in LATER. Reversing that is a new answer, not a re-ask.
* **Branch bases:** `feature/deliveries-improvement` starts from `develop` if the publishing branch has been merged by the owner, otherwise from the last publishing commit (`docs/deliveries/PLAN.md`). Scheduling was started from the deliveries tip instead (A-43). The Phase 12 commit's branch is asked at the Phase 11 gate.
