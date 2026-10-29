# Organization-Level Master Data & Environment Architecture — Design Spec

Date: 2026-10-02
Status: Approved design (pending spec-file review)
Scope: `studiohub-react` (frontend) + `../studiohub` (Django backend)
Related request: Organization-Level Master Data & Environment Architecture with selective / Select All clone from Master.

## 1. Outcome & Success Criteria

Expose applicable Master Data and Environment Architecture configuration at the
Organization Workspace level with the same CRUD capabilities as the Master-level
tabs, plus selective and Select All cloning from Master Data.

Success means:

- Every applicable Master tab has an Organization Workspace equivalent; no
  parallel architecture is introduced.
- Each org tab supports the same applicable CRUD operations as its Master
  counterpart (create, read/list, retrieve, update, delete, search, filter,
  sort, pagination, archive, restore, activate, deactivate — only where the
  domain already supports them).
- Every applicable org tab offers `Clone from Master` with individual selection
  and `Select All` → `Clone Selected`.
- Clone creates only missing records; existing org records (cloned or custom)
  are never overwritten or duplicated; the operation is idempotent and
  transactional with backend duplicate protection.
- New Master records added later are cloneable without touching existing org
  records.
- `Pipeline`, `Color`, `Theme`, `Page Layout`, `DB Schema` are explicitly
  excluded from org-level clone tabs and from any generic clone-everything
  path.
- Frontend uses the real Django REST API only (no mock/MSW/fake data).

## 2. Ground Truth Discovered in Repo (Do Not Re-Invent)

### 2.1 Frontend (`studiohub-react`)

- Master entity defs: `software, statuses, taskTypes, reviewTypes, fileTypes,
  assetTypes, shotTypes`
  (`src/modules/platform/admin/masterData/masterDataEntities.tsx:17`).
- Platform CRUD API: `/api/v1/platform/master-data/*` plus
  `/api/v1/platform/{roles,groups,departments,positions}`
  (`src/api/masterDataApi.ts:30`, `:198`).
- Org tabs already exist for `roles, groups, departments, positions` with bulk
  `CloneMasterButton` (`src/modules/organization/components/CloneMasterButton.tsx:33`)
  calling `POST /api/organizations/{orgId}/{resource}/clone-master/` with `{}`.
- Org `MasterDataTab` (`src/modules/organization/components/tabs/MasterDataTab.tsx:25`)
  covers `software / statuses / tasks` (+ simulation) via the effective/config
  override pattern, not copy-clone.
- Effective/config types: `Effective*` + `Organization*Config`
  (`src/types/masterData.ts:51`); org API: bundle, effective lists, `PUT
  .../config`, `POST .../custom` (`src/api/masterDataApi.ts:144`).
- Workspace shell: `OrganizationWorkspacePage.tsx` sections/tabs, `EntityTabShell`,
  `MasterDataTabShell`, `ScrollableTabs`, `Modal`, `Button`, `SearchInput`,
  notification store, query keys `['organizations', orgId, resource]`.
- The 5 excluded areas do not exist as master entities in this repo.

### 2.2 Backend (`../studiohub`)

- Platform taxonomy (org-RBAC sources):
  `PlatformRole, PlatformGroup, PlatformDepartment, PlatformPosition`
  (`backend/apps/masterdata/models/platform.py:18`).
- Platform catalog: `Software, SoftwareVersion, MasterStatus, MasterTaskType,
  MasterAssetType, MasterShotType, MasterReviewType, MasterFileType`
  (`backend/apps/masterdata/models/catalog.py:13`).
- Per-org overrides (nullable-inherit tri-state — load-bearing, do not collapse):
  `OrganizationSoftwareConfig, OrganizationStatusConfig,
  OrganizationTaskTypeConfig, OrganizationAssetTypeConfig,
  OrganizationShotTypeConfig, OrganizationFileTypeConfig,
  OrganizationReviewTypeConfig`
  (`backend/apps/masterdata/models/config.py:1`).
- Copy-clone service: `clone_master_records` — match by
  `(organization, code)`, wraps batch in `transaction.atomic()`, per-row
  savepoint + `IntegrityError → skip`, DB uniqueness on `(organization, code)`
  (`backend/apps/organization/services/clone_master.py:48`).
- Shared action: `CloneMasterMixin.clone_master`, currently bulk-only (all active
  masters), org from `request.organization`, permission `CREATE` per resource
  (`backend/apps/organization/api/viewsets/clone_master.py:42`,
  `role.py:79`, `group.py:73`, `department.py:71`, `position.py:90`).
- `PositionViewSet.available` with `?include=all_masters` already demonstrates
  the Available vs Already-in-Org code-match pattern
  (`backend/apps/organization/api/viewsets/position.py:93`).
- Org catalog contract: `GET bundle`, `GET {data_type}`, `PUT {data_type}/{id}/config`,
  `POST {data_type}/custom`
  (`backend/apps/masterdata/api/viewsets/organization.py:4`).
- `Theme` lives in `settings`, `Color` is a field — neither is a master clone
  source. No `Pipeline / Page Layout / DB Schema` master models exist.

## 3. Implementation Matrix (Authoritative)

| Master source | Organization tab | CRUD | Selective clone | Select All | Duplicate protection |
|---|---|---|---|---|---|
| `PlatformRole` → org `Role` | Yes (exists, enhance) | Existing behavior | Yes (new `{master_ids}`) | Yes (empty `{}` = all, backward compat) | Yes (code-match + unique + tx) |
| `PlatformGroup` → org `Group` | Yes (exists, enhance) | Existing behavior | Yes | Yes | Yes |
| `PlatformDepartment` → org `Department` | Yes (exists, enhance) | Existing behavior | Yes | Yes | Yes |
| `PlatformPosition` → org `Position` | Yes (exists, enhance) | Existing behavior | Yes | Yes | Yes |
| `Software (+Versions)` | Yes via `MasterDataTab` (enhance) | Existing behavior (effective + config + custom) | Yes via bulk-enable, not copy | Yes | Yes (unique `OrganizationSoftwareConfig`) |
| `MasterStatus` | Yes (enhance) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `MasterTaskType` | Yes (enhance) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `MasterAssetType` | Yes (add sub-tab) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `MasterShotType` | Yes (add sub-tab) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `MasterReviewType` | Yes (add sub-tab) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `MasterFileType` | Yes (add sub-tab) | Existing behavior | Yes via bulk-enable | Yes | Yes |
| `Pipeline` | No | No | No | No | N/A (allowlist-guarded) |
| `Color` | No | No | No | No | N/A |
| `Theme` | No | No | No | No | N/A |
| `Page Layout` | No | No | No | No | N/A |
| `DB Schema` | No | No | No | No | N/A |

Two clone semantics are intentional and must not be unified by copying catalog
rows: RBAC entities copy-clone (independent org rows); catalog entities
enable/config (live reference + override + custom). Both satisfy "Master provides
defaults; Organization data is independently managed."

## 4. Architecture

### 4.1 Backend — RBAC selective clone (extend, don't duplicate)

- Extend `CloneMasterMixin.clone_master` to accept optional body
  `{ "master_ids": ["uuid-1", ...] }`. Absent or empty array preserves current
  Select-All behavior (backward compatible with existing `CloneMasterButton`).
- When `master_ids` present: validate list of UUIDs (400 on invalid/unknown),
  filter `source_model` to `id IN (...) AND is_deleted=False (+ is_active=True
  where the field exists)`; unknown/inactive IDs are reported as skipped, never
  created. Enforce an explicit allowlist of the 4 RBAC resources so the excluded
  areas can never pass through a generic path.
- Delegate to the unchanged `clone_master_records` (code-match, transaction,
  `IntegrityError`-as-skip). Response keeps the established shape:
  `{ created_count, existing_count, created, existing, message }` with messages
  `"<Label> enabled successfully."` / `"All <Label> are already enabled for
  this organization."`.
- Auth chain unchanged: authenticated user → `request.organization` (400 when
  missing, never trust client org ID) → per-resource `CREATE` permission (403)
  → validation → atomic clone. Extend existing `available`-style listing (or a
  `GET .../clone-master/candidates`) only if needed so the modal can show
  Available vs Already-in-Org without N+1 queries (`select_related`/
  `prefetch_related`, pagination, search/filter on the Master list).

### 4.2 Backend — catalog bulk-enable (no copy)

- Add `POST /api/v1/organizations/{orgId}/master-data/{data_type}/bulk-enable`
  with `{ "ids": [...] }` creating `Organization*Config(enabled=True)` rows
  idempotently (unique constraint + `get_or_create` inside a transaction;
  existing configs untouched except ensuring `enabled=True` only when the admin
  explicitly enables). `data_type` is allowlisted to the 7 catalog types.
- Keep `PUT .../config` (overrides) and `POST .../custom` (org-owned records)
  unchanged, including the NULL-means-inherit tri-state.
- Same auth chain (org scope + admin permission + validation + transaction +
  per-record results).

### 4.3 Frontend (reuse existing chrome)

- Upgrade `CloneMasterButton` into a selective modal shared by
  roles/groups/departments/positions: header `[Create] [Clone from Master]
  [Search] [Filter]`; modal shows Master search, checkbox rows, `Available`
  vs `Already in Organization` sections (code-match, mirroring
  `PositionViewSet.available`), `[Select All] [Clear Selection] [Cancel]
  [Clone Selected]`. Sends `{ master_ids }` (or `{}` for Select All legacy
  path during migration), invalidates only `['organizations', orgId, resource]`,
  shows toast `"X records cloned successfully. Y already available, skipped."`
  or `"All selected records are already available in this organization."`.
- Catalog tabs: same modal pattern for bulk-enable on
  `OrgSoftwareConfig / OrgStatusConfig / OrgTaskTypeConfig` + new
  asset/shot/review/file sub-tabs; empty state
  `"No {plural} available for this organization. Create a custom record or
  clone records from Master Data. [Create] [Clone from Master]"`; loading and
  error states via existing query components; org switching refreshes via
  existing `organizationId`-keyed queries.
- New hooks: `usePlatformMasters(resource, orgId)` (candidates) +
  `useCloneMaster(resource, orgId)` (selective mutation); extend
  `masterDataApi` with `clone*Selective` + `bulkEnable*` clients. No MSW/mock;
  real `ApiClient` only.
- Permissions: hide/disable clone affordance without org-admin `CREATE`
  (frontend only for UX; backend 403 remains authoritative).

## 5. Non-Functional Requirements

- Idempotency: repeated identical clone requests create once, skip thereafter.
- Isolation: every org-scoped query filters by the active org; switching orgs
  refreshes tabs, counts, clone availability; never mix org data.
- Performance: bulk endpoints avoid N+1; paginate Master candidate lists;
  single transaction per clone batch.
- Compatibility: existing `{}` clone-all calls keep working; response shape
  unchanged (selective only adds optional request field).

## 6. Testing Plan

Backend (per RBAC resource + per catalog type): create/read/update/delete-archive
org record; clone one; clone many; Select All; clone only selected; clone with
existing records (skip, untouched); re-clone idempotent; new Master added later
clones alone; custom + cloned mix; invalid Master IDs 400; inactive/deleted
masters ineligible; empty Master/Org data; permission 403 without org-admin;
org isolation (A never sees B); concurrent clone races produce no duplicates.

Frontend (Vitest, following `PositionsTabClone.test.tsx`): modal open/search/
select/Select All/Clear; already-in-org disabled or skipped with correct toast;
post-clone refetch; empty/loading/error states; org-switch refresh; permission
gating hides affordance. E2E: Master → Select All → org receives missing only →
add new Master → clone again → only new record created, nothing duplicated or
modified. Lint + typecheck + build green.

## 7. Definition of Done

- [ ] All applicable Master tabs identified (matrix §3, adjusted only to match
  discovered code)
- [ ] Existing org tabs enhanced, none duplicated; missing catalog sub-tabs added
- [ ] Same applicable CRUD available per entity (no invented operations)
- [ ] Selective + Select All clone on every applicable tab
- [ ] Existing records never duplicated or overwritten; custom records independent
- [ ] New Master records cloneable later without side effects
- [ ] Clone idempotent, transactional, DB-unique, backend-authorized, org-isolated
- [ ] Pipeline / Color / Theme / Page Layout / DB Schema excluded + allowlisted
- [ ] Empty / loading / error / result-feedback states implemented
- [ ] Real Django API only
- [ ] Backend + frontend + E2E tests pass; lint, typecheck, build pass
- [ ] `docs/architecture/ORGANIZATION_MASTER_DATA.md` matrix published

## 8. Open Items for Implementation Planning

- Exact `master_ids` key naming (`master_ids` vs `ids`) per backend serializer
  convention — planner to confirm from `backend/AGENTS.md` + existing serializers.
- Whether catalog bulk-enable needs a `GET candidates` endpoint or reuses the
  bundle + config diff on the client.
- Seed data for the 4 `Platform*` tables in dev/test environments.
