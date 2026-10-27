# Publishing contracts

Phase 2 target design, 2026-10-27. Q13-Q38 are answered (ASSUMED, `DECISIONS.md`). **Phase 3 is implemented** (storage roots, files, lifecycle services and API, job codes and links, constraints, verification command); sections marked *Phase 4* or *Phase 5* are still design. Items marked *(Qnn)* cite the decision. Cross-app rules: `docs/delivery-pipeline/CONTRACTS.md` (X-01 to X-10). Audit: `ANALYSIS.md`. Order of work: `PLAN.md`.

**What the app is after this work** (Q1, Q3, Q13): Production's `Version` stays the published record (numbering, approval, publish, hero: production D-29). Publishing owns (1) the **registry of files** of a published version, with their checksums and lifecycle, (2) the **storage roots** those files live under, and (3) the existing **DCC export jobs** (`PublishItem`), now linked to the version they produced. StudioHub registers paths; it never stores or moves bytes.

## 1. Domain contracts

### DOM-PUB-01 `StorageRoot` (new, table `publishing_storage_root`, studio-wide)

| Field | Type / rule |
|---|---|
| base | `EntityModel` (UUID, audit columns, soft delete) |
| `code` | Char 50; letters, digits, `_`, `-`, starts with a letter; unique `upper(code)` among all rows (soft-deleted included, codes are never reused because file rows keep them) |
| `name` | Char 255 |
| `linux_path`, `windows_path`, `mac_path` | Char 500, **display only** (shown to artists; never used by the server to open anything) |
| `is_active` | Bool; inactive roots refuse new files, existing files stay valid |

The **server-side mount** used to verify checksums (DOM-PUB-04) is not a column: it comes from settings, `PUBLISHING_STORAGE_MOUNTS = {"<code>": "/mnt/..."}` read in `config/env.py` (empty by default, so nothing is verified). An API user can therefore never point the server at an arbitrary directory *(Q25)*.

On delete: `PROTECT` from files. A root with files cannot be hard-deleted; soft delete only when it holds no Registered file.

### DOM-PUB-02 `PublishedFile` (new, table `publishing_file`)

One file, or one image sequence, of a published version.

| Field | Type / rule |
|---|---|
| base | `EntityModel`; soft delete is **not** used for lifecycle (status is) and the API cannot delete |
| `version` | FK `production.Version`, `PROTECT` |
| `project` | FK `production.Project`, `PROTECT`; set by the service from the version, never from the body |
| `storage_root` | FK `StorageRoot`, `PROTECT` |
| `relative_path` | Char 1024, normalized (DOM-PUB-03) |
| `role` | `main`, `proxy`, `thumbnail`, `sidecar` |
| `file_type` | FK `masterdata.MasterFileType`, `PROTECT`, nullable |
| `size_bytes` | BigInt, `>= 0` (DB check) |
| `sha256` | Char 64, lower-case hex (service check; DB check `length(sha256) = 64`) |
| `frame_start`, `frame_end` | Int, nullable; both or neither; `frame_end >= frame_start` (DB checks); present means `relative_path` is a sequence pattern (`%04d` or `####`) |
| `checksum_state` | `declared` (default), `verified`, `mismatch`, `missing` *(Q25)* |
| `checksum_checked_at` | DateTime, nullable |
| `status` | `Registered` (default), `Deprecated`, `Revoked` |
| `status_changed_at`, `status_changed_by` | set by the lifecycle service |
| `revoke_reason` | Text; required to revoke; shown only to holders of `publishing.revoke` and the registrant |
| `export_job` | FK `PublishItem`, `PROTECT`, nullable (the job that produced it, when known) |

Constraints and indexes:
* unique `(storage_root, relative_path)` over **all** rows, revoked included: a path, once registered, names that content forever (no overwrite, *Q26*);
* unique `(version, role, relative_path)` is implied by the above;
* index `(version, status)`, `(project, status)`, `(sha256)`.

**Invariants**
1. Registration needs the version to be **published** (`Version.is_published`, D-29) and live, in a project the caller can use.
2. After insert, only `status`, `status_changed_*`, `revoke_reason`, `checksum_state`, `checksum_checked_at` ever change. A model `save()` guard refuses any other changed field (defence in depth beside the service; the admin is read-only).
3. Corrections are made by revoking and registering a new path, or by publishing a new version (*Q26*). Nothing edits a registered file.
4. Unpublishing the version (Production) does not change file rows; such files are simply not *deliverable* (X-04).

**Transition map** (`apps/publishing/constants/workflow.py`, one map, table-driven tests) *(Q27)*:

| From → To | Code | Guard |
|---|---|---|
| Registered → Deprecated | `publishing.deprecate` | optional note |
| Deprecated → Registered (restore) | `publishing.deprecate` | |
| Registered → Revoked, Deprecated → Revoked | `publishing.revoke` | reason required |
| Revoked → anything | `publishing.status.override` + `override_reason` | granted to no role (X-07) |

Everything else is refused (*Q27*: 409 `invalid_transition`). Bulk endpoints use the same map.

### DOM-PUB-03 Path rules (one function, `apps/publishing/domain/paths.py`)

`normalize_relative_path(value) -> str` accepts only:
* POSIX separators (`/`); a backslash, a drive letter (`C:`), a UNC prefix (`\\`), a leading `/` or `~`, NUL or other control characters are refused;
* no `.` or `..` segment, no empty segment (`a//b`), no trailing `/`;
* at most 1024 characters, each segment at most 255;
* the value must equal its own normalized form (it is refused, not rewritten, so what is stored is what the tool sent).

`build_display_path(root, relative)` joins with `PurePosixPath` / `PureWindowsPath` for display only. `resolve_mount(root, relative)` (verification only) joins with the configured mount and refuses any result whose `realpath` is outside the mount (symlink escape). Every path written by the app goes through these functions; a test feeds the traversal corpus (`../`, `..\\`, `%2e%2e/`, `a/../../b`, absolute, UNC, NUL) to every write path.

### DOM-PUB-04 Checksums *(Q25)*

* `PublishedFile.sha256` is the single source of truth for a file's checksum. Deliveries copy it into their snapshot (DOM-DLV-05) and never compute their own.
* For an image sequence, `sha256` is the **sequence digest**: SHA-256 of the UTF-8 lines `"<frame file name>  <sha256 of that frame>\n"` sorted by file name (the `sha256sum` format). The algorithm is published in the API docs so pipeline tools compute it the same way.
* Registration stores the declared value (`checksum_state=declared`). When the root has a configured mount, `manage.py verify_published_files` (run by hand or from cron; the repository defines no Celery app, so nothing queues it) hashes the file in chunks and sets `verified`, `mismatch` (the file differs from what was declared) or `missing`. A `mismatch` or `missing` file cannot be added to a delivery (DOM-DLV-03). Nothing is ever recomputed into `sha256` itself.
* Registering the same `(storage_root, relative_path)` again with the **same** version, size and checksum returns the existing row (200, idempotent retry from a pipeline tool); with any difference it is a 409 `path_already_registered`.

### DOM-PUB-05 `PublishItem` (existing export job, table `publishing_item`) *(Q13 = A)*

Kept as the record of a DCC export job. Changes:

| Field | Today | Target |
|---|---|---|
| `version` | none | FK `production.Version`, `PROTECT`, nullable; when given, `entity_*` and `project` are copied from it and a body that disagrees is a 400 |
| `project` | `SET_NULL`, nullable, any id | `PROTECT` (Q24); **required on create** (resolved through X-03); stays nullable in the DB for old rows |
| `code` | free, not unique, client-generated | unique `upper(code)` over all rows (migration stops and lists duplicates if any, staging query P2); blank → server code `PUB-<project code>-<0001>` from a per-project counter row locked during allocation; a sent code is kept and checked any case |
| `entity_id` | free text | free text kept for old rows; new rows: a UUID of a shot or asset of the project, or blank when `version` is given |
| `status` | written by services and admin, from any state | one map (below); admin read-only |
| `is_archived` | written by `unpublish` | **derived** from the soft delete (production D-25); stored column read-only and deprecated, no longer written (*Q33*) |
| `republished_from` | none | FK self, `PROTECT`, nullable |
| `cancel_reason` | none (reason dropped) | Text |
| `retry_count` | stored | kept (real counter, no longer used for codes) |

Export-job map (working states move as the job runs; only the end states are guarded):

| From | Allowed to |
|---|---|
| Pending | Validating, Cancelled |
| Validating | Validated, Failed, Cancelled |
| Validated | Exporting, Pending (re-validate), Cancelled |
| Exporting | Exported, Failed |
| Failed | Pending (retry), Cancelled |
| Exported | none (final; republish creates a new job) |
| Cancelled | none (final) |

**Validation** (*Q14 = A*): rules return `passed`, `failed`, `warning` or `not_checked` per rule. The server evaluates what it can check without reading files: required metadata present, `export_format` in the rule's allowed list, declared size within limit, checksum present and well formed, path valid (DOM-PUB-03). `FILE_EXISTS`, `FRAME_RANGE` content checks and naming checks against real files are `not_checked` unless the root is mounted. A job is `Validated` only when no `error` / `block` rule failed; `not_checked` never counts as passed in the response summary.

### DOM-PUB-06 `PublishValidationRule` and `PublishDestination`

* Rule: unique `upper(name)`; stays admin-managed (no API), integer pk kept (changing it is destructive). Audit columns are not added (no history need; the change log covers admin edits).
* Destination: unique `upper(name)` among **live** rows (replaces the case-sensitive constraint that included deleted rows; migration lists conflicts first); at most one live `is_default` (partial unique constraint; setting a new default clears the old one in the same transaction). Stays a studio-wide dropdown.

## 2. Services (signatures)

```python
# apps/publishing/services/storage.py
class StorageRootService:
    create(*, actor, data) -> StorageRoot
    update(*, actor, root, data) -> StorageRoot       # code immutable
    retire(*, actor, root) -> StorageRoot             # is_active=False

# apps/publishing/services/files.py
class PublishedFileService:
    register(*, actor, request, version_id, data) -> tuple[PublishedFile, bool]   # (row, created)
    register_many(*, actor, request, items) -> BulkResult                         # X-08 / Q36
    deprecate(*, actor, file, note="") -> PublishedFile
    restore(*, actor, file) -> PublishedFile
    revoke(*, actor, file, reason, override_reason=None) -> PublishedFile        # publishes PublishedFileRevoked
    change_status(*, actor, request, file, target, reason="", override_reason=None) -> PublishedFile  # the only writer of status
    record_verification(*, file_id, state) -> None                                # verification command only

# apps/publishing/services/publish.py (existing, reworked)
class PublishJobService:
    create(*, actor, request, data) -> PublishItem
    update(*, actor, item, data) -> PublishItem       # editable fields only while Pending/Failed
    validate(*, actor, item) -> ValidationReport
    republish(*, actor, item, comment="") -> PublishItem
    cancel(*, actor, item, reason="") -> PublishItem  # the `unpublish` action
    retry(*, actor, item) -> PublishItem
```

Every write is one `transaction.atomic()`, loads the row with `select_for_update()`, checks the map, writes a history row and publishes events with `on_commit=True`.

## 3. API contracts

All under `/api/v1/publishing/`. Existing paths keep their shapes unless stated.

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| API-PUB-01 | `GET /publishing/`, `GET /publishing/{id}/` | every project's jobs | jobs of the caller's projects (X-03); platform admins all; others' ids 404 | lists shrink for non-admins |
| API-PUB-02 | `POST /publishing/` | any project id; unknown id → 500; client code | **Phase 3:** an unknown project is 400 "Unknown project."; `version_id` optional (must exist, of that project); blank code → server code (needs a project); a sent code must be unused in any case; the response now includes `id`. **Phase 5:** project required and membership checked | none yet; the frontend's `project_id` must be sent from Phase 5 on (it already sends it when it is a UUID) |
| API-PUB-03 | `PATCH/PUT /publishing/{id}/` | 500 | 200 with detail shape; editable `name`, `export_options`, `validation_rules`, `dcc_*`, `source_file`, `export_path` (path rules) while Pending or Failed; `status`, `is_archived`, `retry_count`, `code` read-only (400 unless echoed) | the frontend never calls it |
| API-PUB-04 | `POST /{id}/validate/` | any state; "Published" after unpublish | map applies; report has `not_checked` entries | `rule.status` may be `not_checked` (the UI shows unknown values without an icon) |
| API-PUB-05 | `POST /{id}/retry/` | 500 unless Failed | 409 `invalid_transition` unless Failed *(Q27)* | |
| API-PUB-06 | `POST /{id}/republish/` | duplicate codes | new job with server code, `republished_from` set; body `comment` stored | |
| API-PUB-07 | `POST /{id}/unpublish/` | reason ignored | `reason` stored as `cancel_reason`; from Pending/Validating/Validated/Failed only | |
| API-PUB-08 | read shape `status` | Validated/Exported → "Published" | unchanged until Phase 5 (*Q15 = A*); Phase 5 adds `job_status` (raw) beside it; the label change waits for a frontend release | none now |
| API-PUB-09 | `GET/POST /publishing/files/`, `GET /publishing/files/{id}/` | — | new; list filters `version_id`, `project_id`, `status`, `role`, `storage_root`; POST registers one file (201, or 200 for an identical retry); no PUT/PATCH/DELETE (405) | new |
| API-PUB-10 | `POST /publishing/files/bulk-register/` | — | new; Q36 bulk contract (1-100 items, 200/207, per-item `id`, `ok`, `error`) | new |
| API-PUB-11 | `POST /publishing/files/{id}/deprecate|restore|revoke/` | — | new; body `note` / `reason` / `override_reason` | new |
| API-PUB-12 | `GET/POST/PATCH /publishing/storage-roots/` | — | new; studio-wide; DELETE refused while files exist | new |
| API-PUB-13 | `/publishing/destinations/` | case-sensitive names, many defaults | any-case unique among live rows; one default | a second "default" clears the first |

**Request body rules.** Action bodies get declared serializers (OpenAPI shows them); unknown keys are ignored as today, except on file registration, where they are a 400 (pipeline tools must not believe a field was stored).

## 4. Authorization

| Action | Code | Extra |
|---|---|---|
| list / read jobs and files | `publishing.view` | project membership; platform admin all |
| create job, register files | `publishing.create` | member of the version's project |
| edit job, validate, retry, republish, cancel | `publishing.update` | member |
| delete job (soft) | `publishing.delete` | member; refused for jobs with registered files |
| deprecate, restore file | `publishing.deprecate` (new) | member |
| revoke file | `publishing.revoke` (new) | member; reason required |
| cross a final state | `publishing.status.override` (new, seeded to no role) | `override_reason`; history row |
| manage storage roots | `publishing.storage.manage` (new) | studio-wide |
| destinations | `publishing.view/create/update/delete` (as today) | studio-wide |

Role-to-code proposal: `PLAN.md` §6 (*Q34*).

## 5. Security contracts

| ID | Contract |
|---|---|
| SEC-PUB-01 | Every read and write of jobs and files is narrowed to the caller's projects; an id outside them is a 404 identical to an unknown id. |
| SEC-PUB-02 | No user-controlled value is ever joined to a server path except through DOM-PUB-03; the server opens files only under configured mounts. |
| SEC-PUB-03 | No endpoint returns file contents or signed URLs (Q3: register-only). |
| SEC-PUB-04 | Logs carry ids and codes only: no paths of revoked files, no revoke reasons, no checksums of mismatching files (log-capture test). |
| SEC-PUB-05 | The admin is read-only for files, storage roots in use, job status and validation results; no delete for files. |

## 6. Audit events

| Event | Where |
|---|---|
| File registered, deprecated, restored, revoked (with `override_kind`) | `PublishedFileEvent` append-only table (`file`, `from_status`, `to_status`, `actor`, `reason`, `override_kind`, `at`) + `AuditLog` target `publishing` (Q23) |
| Job status changes | change log (exists, `apps/audit/signals/change_tracking.py:232`) + `AuditLog` target `publishing` |
| Checksum verification result | `PublishedFileEvent` with `to_status` unchanged and `kind = verification` |
| Domain event `PublishedFileRevoked` | core event bus, after commit (X-04) |

## 7. Failure behaviour

| Case | Answer |
|---|---|
| Version not published, deleted, or of another project | 400 `{"version_id": ["Unknown or unpublished version."]}` |
| Path refused by DOM-PUB-03 | 400 `{"relative_path": ["..."]}` naming the rule broken |
| Path registered with different content | 409 `path_already_registered` |
| Inactive storage root or file type | 400 |
| Transition not in the map, or lost race | *Q27*: 409 `invalid_transition` |
| Verification task cannot reach the mount | `checksum_state` unchanged, warning logged with root code only |
