# Application: publishing

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/publishing/` (`ANALYSIS.md`, `CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`) and
`docs/delivery-pipeline/`. Status: **phase 4 of 5 done** (integrity and storage; export job workflow); phase 5
(authorization and hardening) follows.

## 2. Application information

```text
Application: publishing  (apps/publishing)
Domain:      What a published version consists of, and the export jobs that produce it
Purpose:     Registry of published files with checksums and lifecycle; DCC export job tracking
Dependencies: core, identity (permissions), masterdata (file types), production (versions, projects)
Status:      In progress (feature/publishing-improvement)
```

## 3. Domain responsibility

**Owns:** storage roots; the files (or image sequences) of a published version with SHA-256,
size, role and lifecycle (Registered, Deprecated, Revoked); the history of each file; export jobs
(`PublishItem`) and their validation rules and destinations.

**Does not own:** version numbering, approval, the publish action, the hero flag (Production,
decision D-29); the bytes of any file. StudioHub registers paths relative to a storage root and
never stores, moves or serves a file (decision Q3). A delivery to a client is Deliveries' job and
reads files only through `PublishedFileSelector` (`selectors/files.py`).

## 4. Dependencies

Imports `production` (selectors only: `VersionSelector`, `ProjectSelector`, and the permission
check helpers), `masterdata` (`MasterFileTypeSelector.resolve_active`), `identity` (`HasPermission`),
`core`. Imports nothing from `deliveries` or `scheduling`. Production does not import this app.

## 5. Folder structure

```text
apps/publishing/
  models/        storage.py, file.py, counter.py, __init__.py (PublishItem, destinations, rules)
  domain/        paths.py  (path rules, pure functions)
  constants/     permissions.py, workflow.py  (the file transition map)
  services/      files.py, storage.py, jobs.py, audit.py, publish.py
  selectors/     files.py (files, X-04 snapshots, storage roots), publish.py, destination.py
  events/        files.py  (PublishedFileRevoked)
  tasks/         verify.py  (checksum verification)
  management/commands/verify_published_files.py
  api/           serializers/, viewsets/, routers.py
  tests/         domain/, services/, api/, tasks/, concurrency/, migrations/
```

## 6. Models

| Model | Table | Notes |
|---|---|---|
| `StorageRoot` | `publishing_storage_root` | code unique in any case over all rows; display paths only |
| `PublishedFile` | `publishing_file` | immutable except lifecycle fields; unique `(storage_root, relative_path)` forever; DB checks on size, sha256 format, frames, revoke reason |
| `PublishedFileEvent` | `publishing_file_event` | append-only: registration, status moves, verifications |
| `PublishCounter` | `publishing_counter` | per-project number for server-made job codes, locked during allocation |
| `PublishItem` | `publishing_item` | export job; new `version`, `republished_from`, `cancel_reason`; code unique in any case |
| `PublishDestination` | `publishing_destination` | name unique in any case among live rows; one default |
| `PublishValidationRule` | `publishing_validation_rule` | unchanged (admin-managed) |

## 7. API (`/api/v1/publishing/`)

`files/` (list, read, register; `bulk-register/`; `{id}/deprecate|restore|revoke/`),
`storage-roots/` (CRUD), `destinations/`, and the existing job endpoints. Files cannot be edited
or deleted through the API. Registering the same path with the same content again returns the
same file (200); different content is 409 `path_already_registered`. A move the transition map
does not allow is 409 `invalid_transition`. Details and error vocabulary: `CONTRACTS.md`.

## 8. Permissions

`publishing.view / create / update / delete` (existing), `publishing.deprecate`,
`publishing.revoke`, `publishing.storage.manage`, and `publishing.status.override` (needed with a
reason to leave Revoked; granted to no role, not implied by superuser, a scoped credential must
list it). Project membership narrows files; jobs are not yet narrowed (phase 5).

## 8b. Export job workflow

One map (`constants/workflow.py`): Pending to Validating; Validating to Validated, Failed or Cancelled;
Validated to Exporting, Pending (re-validate) or Cancelled; Exporting to Exported or Failed; Failed to
Pending (retry) or Cancelled. Exported and Cancelled are final. `JobService` (`services/workflow.py`)
is the only writer of a job's status; every other path (`PATCH`, the admin) is read-only for it.
A move the map forbids, or the loser of a race, is 409 `invalid_transition`. A job's details can be
edited only while it is Pending or Failed. `republish` starts a new job from any status.

Validation (`services/validation.py`) reports each active rule as `passed`, `failed`, `warning` or
`not_checked`. It only says `passed` for what the server checked (the job's details, its registered
files and their checksum state, the version's frame range). Configure rules in the admin:
`metadata` (`{"required": [...]}`), `file_format` (`{"allowed_formats": [...]}`), `file_size`
(`{"max_bytes": N}`), `frame_range` and `file_exists` need no config; `dependencies` and `permissions`
are always `not_checked`.

## 9. Operations

* **After deploying, run `uv run python manage.py init_platform`** on every database: it adds the
  new permission codes and grants them (`deprecate` and `revoke` to the full production roles,
  `storage.manage` to org-admin; platform-admin holds the whole catalog).
* **Migrations 0008 and 0009 refuse, changing nothing,** when existing rows would break the new
  constraints (job codes equal in any case; destination names equal in any case; more than one
  default destination) and list the rows. Fix them and migrate again. The read-only query P2 in
  `docs/delivery-pipeline/ANALYSIS.md` section 8 counts the code duplicates beforehand.
* **Checksum verification** is optional. Set `PUBLISHING_STORAGE_MOUNTS` to a JSON object such as
  `{"PROJECTS": "/mnt/projects"}` (storage root code to a directory the app server can read) and run
  `uv run python manage.py verify_published_files` by hand or from cron. It records `verified`,
  `mismatch` or `missing` for files whose checksum is only declared; it never changes a declared
  checksum and prints counts only. The repository defines no Celery app (`config/celery.py` is
  empty), so nothing runs it automatically.
* **Sequence checksum:** for an image sequence, `sha256` is the SHA-256 of the lines
  `"<frame file name>  <frame sha256>\n"` sorted by file name (the `sha256sum` listing).

## 10. Tests

`uv run pytest apps/publishing`. The concurrency tests need PostgreSQL (row locks);
`tests/migrations` runs the migrations forward, backward, forward on the test database.
