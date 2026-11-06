# Episodic gating and bulk operations: Phase 0 discovery

Status: discovery only, nothing changed. Written 2026-11-06 on `develop` (3d3c8f43).
Claims marked **(probed)** were checked against the backend with a throwaway pytest probe
(factory data on the pytest test database, file deleted after the run). Everything else comes from
reading the code at the paths given.

## 0. Summary

* **"Episodic" already exists.** `Project.workflow_type` (`standard` | `episodic`) is set on
  create, can't be changed afterwards, is serialized in the project payload, and is typed on the
  frontend. **No model change or migration is needed.**
* **The episode rules for sequences and shots already exist (D-12)** on single create and update.
  Episode **create** is refused on standard projects (400). Episode **list, detail, update and
  archive are not gated** (probed: 200 on a standard project).
* **Bulk create, bulk update, archive, restore and check-existence already exist** for episodes,
  sequences, shots, assets and tasks (`ProductionBulkMixin` + `BulkOperationService`). The
  frontend has a shared grid, preview and result toolkit (`shared/components/bulk/`) and a "Bulk
  add" manager for shots, assets and tasks. Bulk *update* has no UI.
* **Security defect in the existing bulk paths (probed).** A bulk path can see and write more
  than the single path allows. Members narrowed to a show, to a department, or external
  (vendor/client) members get 404 on a single PATCH of a record outside their reach, but
  `bulk-update` writes the same record. `check-existence` returns the full serialized record of an
  out-of-scope row. Bulk create skips the show binding: a show-bound member's bulk-created shot
  gets no show and drops out of their own view. This is live in v4.3.0 and should be fixed first
  (§6, CR-46).
* **Bulk update skips the entity's update rules (probed).** The episode/sequence chain (D-12) and
  show filing (`_resolve_show`) live in `perform_update`, which bulk does not call. Any bulk item
  carrying `episode_id` or `show_id` gives a **500** (`Cannot assign "UUID(...)": "Shot.show" must
  be a "Show" instance`).
* **No row cap** on bulk (probed: 1,500 items accepted). The only limit is Django's default 2.5 MB
  body size (`DATA_UPLOAD_MAX_MEMORY_SIZE` is not set anywhere).
* **The frontend has three different episodic checks**, one of which disagrees with the backend
  (§3.2).

## 1. How "episodic" is represented

| Where | What |
|---|---|
| `backend/apps/production/models/project.py:43` | `workflow_type` CharField, choices `ProjectWorkflowType` (`constants/project.py:19`: `standard`, `episodic`), default `standard`, indexed. |
| `backend/apps/production/models/project.py:30` | `type` (`Feature Film`, `Episodic Series`, …) is a **separate display label**. The backend never derives episodic behaviour from it. |
| `api/serializers/project/create.py:27` | `workflow_type` writable on create. |
| `api/serializers/project/update.py` | `workflow_type` **not** in the update fields: it can't be changed after create. Frontend agrees (`structure/configs.tsx:60`, `immutableOnEdit: ['workflow_type']`). |
| `api/serializers/project/base.py:53` | `workflow_type` is in every project read payload (list and detail). |
| `api/viewsets/project.py:83` | Creating an episodic project bootstraps episode `EP101`. |
| Backend consumers | `viewsets/episode.py:70` (create gate), `viewsets/sequence.py:92` (D-12 sequence rule), `viewsets/shot.py:177` (episode required on episodic), `management/commands/report_production_data.py:142`. |
| Frontend type | `frontend/src/api/production/structure.ts:14,26`: `PROJECT_WORKFLOWS`, `Project.workflow_type`. |
| Frontend project context | `core/production/useProductionStore.ts` holds **only `activeProjectId`** (persisted). The project object comes from `useProjects()` in `layouts/ProjectSwitcher.tsx:34`. No hook returns the active project or its workflow. |

**How existing data can disagree.** `workflow_type` can't be changed through the API, but seeds,
the admin, or legacy data can leave episodes, or sequence/shot `episode` links, on a standard
project (probed: an `EpisodeFactory` row on a standard project is listed, read and patched with
200). `report_production_data` does not list these today.

## 2. Backend: models, parents, serializers, viewsets, URLs, permissions

### 2.1 Models and parents

| Model | File | Parents | Code uniqueness |
|---|---|---|---|
| `Episode` | `models/episode.py` | `project` (CASCADE), `show` (SET_NULL, nullable) | `(project, upper(code))`, soft-deleted included |
| `Sequence` | `models/sequence.py` | `project`, `show`, **`episode` (PROTECT, nullable)**, `lead_artist` | `(project, upper(code))` |
| `Shot` | `models/shot.py` | `project`, `show`, **`episode` (SET_NULL, nullable)**, **`sequence` (PROTECT, nullable)**, `assigned_artist` | `(project, upper(code))` |
| `Asset` | `models/asset.py` | `project`, `show`, `asset_type`, `department`, `team`, `parent_asset`. **No episode or sequence.** | `(project, upper(code))` |
| `Task` | `models/task.py` | `project`, one of `shot` / `asset` / `sequence` (D-28), `task_type`, `team`, `assignee`, `reviewer` | `(project, upper(code))` |
| `Show` | `models/show.py` | `project` | `(project, code)` |
| `ProjectMembership` | `models/project_membership.py` | `project`, `user`, optional `show` (show-bound), `department`/`department_id` (department-narrowed), `vendor_id`/`client_id` (external) | `(project, user)` |

**Sequence ↔ Episode (D-12, `docs/production/DECISIONS.md:103`).** On an episodic project a new
sequence needs an episode of that project; an existing sequence without one keeps working but
can't have it cleared once set. On a standard project an episode is a 400 and an empty value is
accepted. A shot follows its sequence's episode: a different one is a 400, and an omitted one is
taken from the sequence. A shot with no sequence keeps its own `episode`, which is still required
on episodic projects. So the hierarchy is **Project → (Episode →) Sequence → Shot**, with
`Shot.episode` denormalized and checked against the sequence. Sequence and Shot hang off Project
directly, so a standard project simply has no episode level; the data model needs no change.

### 2.2 Serializers

Episode, sequence, shot and asset each have `base / create / update / list / detail` under
`api/serializers/<entity>/`. The write serializers take references as aliases (`episode_id`
→ `episode`, `sequence_id` → `sequence_ref`, `show_id` → `show`) that arrive as **raw
strings or UUIDs**. The viewset resolves them inside the project before saving, which is why
skipping that step gives a 500.

`api/serializers/episode/bulk.py` and `sequence/bulk.py` (`*BulkItemSerializer`) are
**referenced nowhere**: dead code.

### 2.3 Viewsets and the single-row chain

`api/viewsets/base.py` `ProductionEntityViewSet` is the single-row control:

* reads go through `get_queryset()` (`:65`): selector → `scope_by_request` →
  `scope_by_project_membership` (project + show/department narrowing + external grants,
  `selectors/base.py:182`, `selectors/internal_scope.py`, `selectors/external_scope.py`) →
  `narrow_queryset` hook;
* `perform_create` (`:368`): project access → natural-key uniqueness → `prepare_create` →
  `validate_references` → privileged values → initial status → **`_resolve_show`** →
  **`_with_default_show`** → service;
* `perform_update` (`:452`): `guard_mutable` → `validate_references` → privileged values →
  **`_resolve_show`** → `_apply_update` (status workflow through `StatusService`). Sequence
  (`viewsets/sequence.py:68`) and Shot (`viewsets/shot.py:111`) override `perform_update` to run
  the **D-12 episode chain** first.

### 2.4 The bulk chain (what differs)

`core/api/mixins/bulk.py` `BulkActionsMixin` → `production/api/viewsets/bulk.py`
`ProductionBulkMixin` → `production/services/bulk.py` `BulkOperationService`.

| Step | Single | Bulk create | Bulk update | Bulk archive/restore |
|---|---|---|---|---|
| Row visibility | `get_queryset()` (full narrowing) | n/a | **`_allowed_project_ids`: any active membership, no show/department/external narrowing** | **same as bulk update** |
| Write serializer | ✓ | ✓ | ✓ (partial) | n/a |
| `prepare_create` (episode rule) | ✓ | ✓ (probed: refused without episode) | n/a | n/a |
| Episode/sequence chain on update | ✓ (`perform_update`) | n/a | **✗ (probed: 500)** | n/a |
| `_resolve_show` / `_with_default_show` | ✓ | **✗ (probed: no show)** | **✗ (probed: 500)** | n/a |
| `guard_mutable`, `narrow_queryset` | ✓ | n/a | **✗** | **✗** |
| `validate_references`, privileged values, status workflow | ✓ | ✓ | ✓ | n/a |
| Transaction | one per request | **one savepoint per item (partial success)** | per item | per item |

Probe results (narrowed member against a record outside their reach):

| Caller | Single PATCH | `bulk-update` |
|---|---|---|
| Show-bound to show A, shot in show B | 404 | **200, written** |
| Department `Comp`, shot with no Comp task | 404 | **200, written** |
| External vendor member | 404 | **200, written** |
| Show-bound, `check-existence` of a show-B code | n/a | **200 with `existing_entity` (full record)** |

Bulk archive/restore use the same `_allowed_project_ids` lookup, so I expect the same leak there.
I confirmed this by reading the code, not with the probe. The Phase 1 test will pin it.

Task is the counter-example: `tasks/bulk-status`, `bulk-assign`, `bulk-archive` and
`bulk-delete` (`viewsets/task.py:134-277`) resolve rows through `self.get_queryset()`, and
`bulk-status` caps at 1-100 ids. That is the pattern to reuse.

### 2.5 URLs

`api/urls.py` registers `projects`, `episodes`, `sequences`, `shots`, `assets`, `tasks`, `shows`, …
under `/api/v1/`. Each bulk viewset adds `check-existence/` (+ legacy `existence-check/`),
`bulk-create/`, `bulk-update/` (POST/PATCH), `bulk-archive/`, `bulk-restore/`, `archived/`,
`{id}/archive/`, `{id}/restore/`. Project-scoped read aliases under
`/api/organizations/projects/<id>/{sequences,shots,assets,tasks,…}` (`api/urls_project_scoped.py`);
there is no `episodes` alias there.

### 2.6 Permissions

`constants/permissions.py`: `episode.{view,create,update,delete}`, `sequence.{…}`, `shot.{…,approve}`,
`asset.{…}`, `task.{…}`. Every viewset maps `bulk_create → CREATE`, `bulk_update → UPDATE`,
`bulk_archive → DELETE`, `check_existence → CREATE` (`permission_map`). Enforced by
`HasPermission` (identity) plus project membership as above.

### 2.7 Audit

* **Per row:** `apps/audit/signals/change_tracking.py:223` records a `ChangeLog` row for every
  save/delete of Project, Sequence, Shot, Asset, ShotAsset, Task, Version, Episode, Review,
  Timelog and ProjectMembership, with FK diffs for production models. Bulk writes go through
  `service.create/update` and `save()`, so **each bulk row is already logged**.
* **Per batch:** nothing. `apps/audit/models/audit_log.py` (`action`, `target_type`, `actor`,
  `metadata`, `project_id`) and `AuditLogService.create_log` are available.

### 2.8 Async

Celery is configured (`config/settings/components/celery.py`; eager in tests), and
`apps/audit/services/background_job.py` `BackgroundJobService` runs deliveries and publishing
(`apps/deliveries/services/delivery.py`). Production has no task module.

## 3. Frontend: routes, navigation, pages, permission checks

### 3.1 Navigation

`frontend/src/layouts/Sidebar.tsx:61`: the nav config is **inline** (`navSections`). PRODUCTION
holds Projects, Shots, Assets, Tasks, Timelogs, Versions, Publishing, Deliveries, Reviews,
Workflows and Scheduling (lucide icons; `pagePermission` + `permissions` evaluated by
`evaluateUserPermission(user, code, { projectId: activeProjectId })`; active state from `NavLink`).
**No Episodes or Sequences items.** Test: `layouts/__tests__/SidebarAccessGate.test.tsx`.

### 3.2 Episodic checks today (three, inconsistent)

| Where | Check | Problem |
|---|---|---|
| `modules/production/projectWorkflow.ts` `isEpisodicProject` | `workflow_type === 'episodic'` **or** `type === 'Episodic Series'` / `'Episodic'` / legacy spellings | A standard project labelled *Episodic Series* is treated as episodic; the backend refuses its episodes. |
| `modules/shots/components/ShotBulkAdd.tsx:19` | `workflow_type === 'episodic'` | matches the backend |
| `modules/production/components/project-tabs/ProjectEpisodesTab.tsx:10` | `workflow_type === 'standard'` → hide | inverted: unknown/missing → shown |

Ungated episode UI: the shot form always shows the Episode picker
(`modules/production/work/shots.tsx:80`, labelled "required on episodic projects"); the
**sequence form always shows the Episode picker** (`structure/configs.tsx:144,186`), and the
backend returns 400 if one is chosen on a standard project. The shot list has no episode column or
filter. Assets have no episode anywhere (correct).

### 3.3 Routes and pages

`routes/AppRoutes.tsx`: `/shots`, `/assets`, `/tasks` (+ `/new`, `/:id/edit`, workspace routes),
each a `DirectoryListPage` config (`modules/production/work/{shots,assets,tasks}.tsx`) listing
**across the caller's projects** with a `project_id` filter. Episodes and sequences exist **only
as project-workspace tabs** (`/projects/:id/episodes|sequences`, via `ProjectWorkspace.tsx:274`,
which hides the Episodes tab with `isEpisodicProject`), rendered by `RelatedRecords` with
`episodesConfig` / `sequencesConfig` (`structure/configs.tsx:112,163`: list, create, edit,
archive, archived view). Route guards: `ProjectRoute`, `PermissionRoute`,
`core/permissions/routePermissionsRegistry.ts`. **`page.project.episodes` / `page.project.sequences`
page codes already exist** (`permissionMap.ts:157,166`, registry `:861,865`).

### 3.4 Permission helpers

`useCan(code, { projectId })`, `evaluateAccess`, `PermissionGate` / `PermissionButton`
(`core/permissions/`). `DirectoryListConfig` carries `managePermission`, `createPermission`,
`deletePermission` (`modules/directory/types.ts:72`).

## 4. Existing bulk / import / CSV code to reuse

| Piece | Path | State |
|---|---|---|
| Typed bulk routes | `api/production/bulkRoutes.ts` (`shotBulk`, `assetBulk`, `taskBulk`); `structure.ts:312` `archivable()` for episodes and sequences | ready; no sequence entry in `bulkRoutes` |
| Bulk hook | `shared/hooks/useBulkEntity.ts` (`checkExistence`, `bulkCreate`, `bulkUpdate`, archive, restore, cache invalidation) | `bulkUpdate` has no UI caller |
| Grid / preview / result | `shared/components/bulk/`: `BulkImportGrid`, `BulkOperationPreview`, `BulkValidationSummary`, `ExistingEntityResolver`, `SoftDeletedEntityRecovery`, `BulkOperationResult` (has a CSV/JSON download, `:56`), `BulkOperationEngine` (paste parser), `types.ts` (`BulkUpdateFieldConfig` exists) | reusable |
| Per-entity managers | `modules/shots/components/bulk/ShotBulkManager.tsx` (episodic-aware columns and prompts), `assets/components/bulk/AssetBulkManager.tsx`, `tasks/components/bulk/TaskBulkManager.tsx` | **create only** |
| Entry points | `ShotsPage` → `ShotBulkAdd`; `AssetsPage` → `BulkAddButton`; project tabs. **`TasksPage` has none.** None checks `*.create` before showing the button. | shown only once a project filter is chosen |
| Row selection + actions | `DirectoryListPage.tsx:58,143` with `config.bulk.actions` (`BulkAction`: confirm, optional "choose first" input, `available(filters)`); used today for Archive (shots/assets) and Set status/assign (tasks) | the base for "edit common fields on selected rows" |
| CSV export | `shared/data/exportAll.ts` `toCsv` + Blob download | reuse for templates and error reports |
| CSV **import** | none. `BulkOperationEngine.parseInput` splits on `,`/tab with **no quote handling**, so `"Smith, J"` breaks. There is no file input. | needs a small RFC-4180 parser (no new dependency) |

## 5. How unique codes and names are enforced

* **Codes:** unique per project, case-insensitive, soft-deleted rows included, for episode,
  sequence, shot, asset, task (and version): database `UniqueConstraint(Upper("code"), "project")`
  on each model, plus `unique_together`. Stored trimmed and upper-cased; whitespace or `/` is a 400
  (`NormalizedCodeMixin`, D-10). `_enforce_natural_key_uniqueness` (`viewsets/base.py:567`) gives
  a 400 rather than an IntegrityError. Shot/asset codes freeze once a version exists
  (`rename-code` action, D-10).
* **Not** unique per episode or per sequence: `SH010` can exist only once in a project, whatever
  its sequence. **A bulk-update key is therefore `(project, code)`; episode or sequence codes are
  never needed to disambiguate.**
* **Names:** no uniqueness anywhere.
* **Within a batch:** `BulkOperationService._create_items` reports a repeated code as `duplicate`;
  existing and archived codes as `exists` / `soft_deleted` (with `suggestedAction` skip or
  recover).
* **Numbering:** `code_prefix` in flat bulk-create assigns `SH0010, SH0020…` under a project lock
  (D-23).

## 6. Proposed plan

Following `CLAUDE.md`, each backend change gets a change request in
`docs/sync/backend-change-requests.md` (the next free numbers are CR-46 to CR-48) and is applied
on your approval of this plan. Branch: `feature/episodic-bulk`, one commit per step, a short
verification note per phase.

### Phase 1a: bulk scope parity (CR-46, security fix, first)

* `bulk-update`, `bulk-archive`, `bulk-restore`: resolve each id through the viewset's
  `get_queryset()` (the Task pattern), so out-of-scope ids report `not_found` exactly like a single
  404. `_allowed_project_ids` is then used only for create.
* `bulk-update`: run the same per-row update preparation as `perform_update`. Extract a
  `prepare_update(instance, data)` hook that holds `guard_mutable`, the D-12 chain (Sequence, Shot)
  and `_resolve_show`; `perform_update` and the bulk item both call it. This turns the 500s into
  per-row 400s.
* `bulk-create`: add `_resolve_show` and `_with_default_show` per item, so it matches single create.
* `check-existence`: for a code that exists outside the caller's reach, report `EXISTS` (the code
  is taken, the same thing a single create's 400 reveals) but **without** `existing_entity`.
* Tests: show-bound, department, external and cross-project callers, for each bulk route.
* Response shapes unchanged.

### Phase 1b: episodic gating (CR-47)

Backend:
* `EpisodeViewSet.get_queryset` (or the `EpisodeSelector`) adds
  `project__workflow_type="episodic"`. Detail, update, archive, restore and bulk then give **404**
  for a standard project's episodes, through the normal path. The list returns only episodic
  projects' episodes, and `?project=<standard>` gives `200 []`.
* Episode **create** on a standard project stays **400 `{"project": …}`** (existing, tested
  contract; see decision 1).
* Move the D-12 rules from the viewsets into a validator (`validators/episodic.py`) called from
  `prepare_create` / `prepare_update`, so single and bulk run the same code ("validate in
  serializers/services, not only views").
* `workflow_type` is already in the project payload: nothing to add.
* `report_production_data`: add "episodes on standard projects" and "sequences/shots with an
  episode on a standard project". Read only.

Frontend:
* One helper, `useProjectIsEpisodic(projectId?)`, plus a pure
  `isEpisodic(project) = workflow_type === 'episodic'`. `projectWorkflow.ts` is narrowed to that
  (the label-based fallbacks dropped and listed as dead code) and the two ad-hoc checks are
  replaced.
* Gate: Episodes nav item, `/episodes*` routes (not-found page for a standard or no active
  project), the Episodes tab, the episode picker in the sequence and shot forms, a new Episode
  column and filter on Shots/Sequences (episodic only), breadcrumbs.
* The active project comes from `useProductionStore.activeProjectId` + the project query, so
  switching projects re-renders the nav and routes from React Query (no copied state).

### Phase 2: navigation and pages

* Sidebar PRODUCTION: `Episodes` (icon `ListVideo`, episodic only, `page.project.episodes` +
  `episode.view`) and `Sequences` (`Layers`, `page.project.sequences` + `sequence.view`), placed
  between Projects and Shots.
* `/episodes`, `/episodes/new`, `/episodes/:id/edit`, `/sequences`, … as `DirectoryListPage` /
  `DirectoryFormPage` configs reusing `episodesConfig` / `sequencesConfig` columns and fields
  (the Shots pattern); registry entries in `routePermissionsRegistry.ts`. Detail = the edit form
  plus the existing record workspace pieces (no new workspace layout).

### Phase 3: bulk create and update (CR-48)

Backend (additive; existing callers unchanged):
* New body flags on the existing `bulk-create` / `bulk-update`: `dry_run: true` (validate only: runs
  the real path inside a transaction that is rolled back, so database constraints and the status
  map are checked too) and `atomic: true` (all-or-nothing: any failed row rolls the batch back and
  every row reports its status). The new UI always sends `atomic: true` unless the user ticks
  "Skip invalid rows".
* Bulk update matches by `id` **or** `code` (within the one `project_id` the batch names); both
  given and disagreeing is a row error; a code matching no visible row is `not_found`.
* Parents by code inside the project: `episode` (episode code), `sequence` (sequence code), and for
  tasks `entity_type` + `entity_id` (id or code), all through the existing resolvers. Unknown or
  out-of-scope parents read "Unknown …" (no existence leak).
* Updatable-field whitelist per entity (a `bulk_update_fields` tuple on the viewset, intersected
  with the update serializer). `project`, `code` (where frozen), `created_by`, `is_deleted`, `id`
  and approval fields are never bulk-updatable.
* Limits: **500 rows** per request (400 for the whole request above that) and the existing 2.5 MB
  body limit. Above that the UI asks for another file. No async in this round (see decision 4).
* Per-row errors keep the existing `results[]` item and add a flat `errors: [{row, field,
  message}]` list, so the existing `error` field is not reshaped.
* One `AuditLog` row per committed batch (`action="bulk_create"` / `"bulk_update"`,
  `target_type`, `project_id`, `actor`, `metadata={operation_id, counts}`), next to the per-row
  `ChangeLog` rows the signals already write. Nothing is written for a dry run.

Frontend (on the Sequences, Shots, Assets and Tasks list pages):
* A "Bulk" menu (`WorkspaceOverflowMenu` pattern) offering Bulk create / Bulk update, shown with
  `*.create` / `*.update` and once a project is chosen.
* Input: CSV file or paste into `BulkImportGrid`; "Download template" per entity and project
  (episode column only when episodic); RFC-4180 parser added to `BulkOperationEngine`.
* Flow: input → dry run → `BulkOperationPreview` (create/update/skip/error per row) → commit →
  `BulkOperationResult` with the error report as CSV (`toCsv`).
* Selected rows: a "Edit fields" bulk action in `DirectoryListPage` sends `bulk-update` with the
  common fields for all the ticked ids.
* The existing "Bulk add" managers are folded into the new Bulk create (decision 5).

### Phase 4: tests and verification

Backend tests for every case listed in the brief, plus the probe cases above as regressions.
Frontend tests with captured samples (`docs/sync/samples/`, new captures for the new shapes). Gates:
`ruff`, `manage.py check`, targeted pytest per phase and the **full suite at the end** (please
confirm), and `pnpm typecheck`, `biome`, `pnpm test`, `pnpm build`, `unreachable.mjs`.
Docs: `docs/production/DECISIONS.md` (D-39 onward), `CONTRACTS.md`, a README section for the CSV
formats, and the final summary.

## 7. Existing projects: what changes

* **Standard projects with episode rows** (seed/admin/legacy): after 1b those episodes disappear
  from the API (404 and empty lists). Rows are **not** deleted; `report_production_data` lists
  them. Sequences/shots on standard projects that point at an episode keep the link in the
  database and their `episode_id` stays in the response (shapes unchanged); the UI hides the
  column there.
* **Narrowed and external members** lose the bulk writes outside their reach that they could make
  until now (that is the fix).
* **Episodic projects:** no change in behaviour, except bulk update now applies D-12 (a 400 per row
  instead of a 500).

## 8. Decisions needed

1. **Status for refused episode calls.** Recommended: 404 for list/detail/update/archive (by
   filtering the queryset), keep the existing **400** on create (tested contract, and the client
   already names the project). Alternative: 404 on create too (a contract change).
2. **What the Episodes/Sequences pages list.** Recommended: like Shots, across the caller's
   projects with a Project filter; the Episodes nav item shows while the *active* project
   (switcher) is episodic, and its project filter offers only episodic projects. Alternative: both
   pages strictly scoped to the active project.
3. **Atomic default.** Recommended: the API default stays per-row (today's contract, used by the
   existing managers); the new UI sends `atomic: true` by default. Alternative: change the API
   default to atomic (breaks existing callers' partial-success behaviour).
4. **Large batches.** Recommended: cap at 500 rows, no async now (the Celery /
   `BackgroundJobService` route is available later). Alternative: an async import job in this
   round.
5. **Existing "Bulk add" managers.** Recommended: replace them with the new Bulk create (one
   pattern), removing the old code in its own commit. Alternative: keep both.
6. **Order.** Recommended: ship CR-46 (the scope fix) as its own commit and verification first,
   since it's a live defect, then continue with 1b.
