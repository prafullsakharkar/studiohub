# Organization Master Data — Selective Clone Matrix

Date: 2026-10-02
Scope: `studiohub-react` (frontend) + `../studiohub` (Django backend)
Spec: `docs/superpowers/specs/2026-10-02-org-master-data-design.md` §3 (authoritative matrix, updated here with as-built names)

## Clone semantics (applies to every row below)

- **RBAC entities copy-clone** (independent org rows). **Catalog entities enable/config only** — bulk-enable creates `Organization*Config(enabled=True)` rows; catalog master rows are never copied and the NULL-inherit tri-state in `config.py` is never collapsed.
- **Clone is add-missing-only**: match by `(organization, code)`; existing org records are never overwritten or duplicated; repeat requests are idempotent; each batch runs in a single `transaction.atomic()`.
- **Backend is authoritative**: auth chain is authenticated user → `request.organization` (never trust client org IDs) → per-resource CREATE / `organization.master_data.configure` → validation → atomic write.

## As-built endpoints and components

| Concern | As-built name |
|---|---|
| Backend RBAC selective clone | `CloneMasterMixin.clone_master` (`backend/apps/organization/api/viewsets/clone_master.py`, `url_path="clone-master"`), optional body `{master_ids}`; absent or `[]` = Select All (backward compat); malformed entries → 400; well-formed-but-unknown UUIDs → 200 no-op (skipped) |
| Backend catalog bulk-enable | `OrganizationMasterDataViewSet.bulk_enable` (`backend/apps/masterdata/api/viewsets/organization.py`), `POST organizations/<uuid:organization_id>/master-data/<str:data_type>/bulk-enable` (registered before the generic `<str:data_type>` route), body `{ids}`, response `{enabled_count, existing_count, enabled, existing, message}`; unknown `data_type` → 404 |
| Frontend API clients | `masterDataApi.cloneOrgResource(orgId, resource, masterIds?)` → `POST /api/organizations/{orgId}/{resource}/clone-master/` with `{master_ids}` or `{}`; `masterDataApi.bulkEnableCatalog(orgId, dataType, ids)` → `POST /api/v1/organizations/{orgId}/master-data/{dataType}/bulk-enable` with `{ids}` (`src/api/masterDataApi.ts`) |
| Frontend clone UX | `CloneMasterModal` (presentational: search, Available vs Already-in-Organization sections, Select All / Clear / Clone Selected) + `useCloneMaster(orgId, resource)` hook (selection state, mutation, `['organizations', orgId, resource]` invalidation, count toast) + `CloneMasterButton` container |
| Frontend catalog tabs | `MasterDataTab` sub-tabs + generic `OrgCatalogConfig` (parameterized by `dataType`) + `ORG_CATALOG_DATA_TYPES` allowlist in `src/core/masterData/useMasterData.ts` + generic `useOrganizationCatalog(orgId, dataType)` resolver |

## Matrix: Master Entity → Org Tab → CRUD → Selective → Select All → Dup protection

| Master source | Organization tab | CRUD | Selective clone | Select All | Duplicate protection |
|---|---|---|---|---|---|
| `PlatformRole` → org `Role` | `RolesTab` + `CloneMasterButton`/`CloneMasterModal` (exists, enhanced) | Existing behavior | Yes — `POST /api/organizations/{orgId}/roles/clone-master/` `{master_ids}` | Yes — `{}` = all | Yes (code-match + unique + tx) |
| `PlatformGroup` → org `Group` | `GroupsTab` + `CloneMasterButton`/`CloneMasterModal` (exists, enhanced) | Existing behavior | Yes — `.../groups/clone-master/` `{master_ids}` | Yes | Yes |
| `PlatformDepartment` → org `Department` | `DepartmentsTab` + `CloneMasterButton`/`CloneMasterModal` (exists, enhanced) | Existing behavior | Yes — `.../departments/clone-master/` `{master_ids}` | Yes | Yes |
| `PlatformPosition` → org `Position` | `PositionsTab` + `CloneMasterButton`/`CloneMasterModal` (exists, enhanced) | Existing behavior | Yes — `.../positions/clone-master/` `{master_ids}` | Yes | Yes |
| `Software (+Versions)` | `MasterDataTab` → `software` sub-tab (enhance) | Existing (effective + `PUT .../config` + `POST .../custom`) | Yes via `.../master-data/software/bulk-enable` `{ids}` | Yes | Yes (unique `OrganizationSoftwareConfig`; existing rows untouched) |
| `MasterStatus` | `MasterDataTab` → `statuses` sub-tab (enhance) | Existing behavior | Yes via `.../master-data/statuses/bulk-enable` | Yes | Yes |
| `MasterTaskType` | `MasterDataTab` → `task-types` sub-tab (enhance) | Existing behavior | Yes via `.../master-data/task-types/bulk-enable` | Yes | Yes |
| `MasterAssetType` | `MasterDataTab` → `asset-types` sub-tab (`OrgCatalogConfig`, added) | Existing behavior | Yes via `.../master-data/asset-types/bulk-enable` | Yes | Yes |
| `MasterShotType` | `MasterDataTab` → `shot-types` sub-tab (`OrgCatalogConfig`, added) | Existing behavior | Yes via `.../master-data/shot-types/bulk-enable` | Yes | Yes |
| `MasterReviewType` | `MasterDataTab` → `review-types` sub-tab (`OrgCatalogConfig`, added) | Existing behavior | Yes via `.../master-data/review-types/bulk-enable` | Yes | Yes |
| `MasterFileType` | `MasterDataTab` → `file-types` sub-tab (`OrgCatalogConfig`, added; includes `CONFIG_MAP["file-types"]` + `OrganizationFileTypeConfigSerializer` gap fix) | Existing behavior | Yes via `.../master-data/file-types/bulk-enable` | Yes | Yes |
| `Pipeline` | No | No | No | No | N/A (allowlist-guarded) |
| `Color` | No | No | No | No | N/A |
| `Theme` | No | No | No | No | N/A |
| `Page Layout` | No | No | No | No | N/A |
| `DB Schema` | No | No | No | No | N/A |

## Allowlist note

- Backend: `CONFIG_MAP`/`CREATE_MAP`/`RESOLVERS` keys are exactly the 7 catalog types (`software, statuses, task-types, asset-types, shot-types, review-types, file-types`); `bulk_enable` 404s on any other `data_type`. RBAC clone goes through the shared `CloneMasterMixin` on the 4 org viewsets only — there is no generic clone-everything path.
- Frontend: `ORG_CATALOG_DATA_TYPES` (same 7 strings) is the sole source of catalog sub-tab IDs and `dataType` values; the 5 excluded areas appear nowhere as tab IDs or `dataType` values.
- `Theme` lives in settings and `Color` is a field — neither is a master clone source; no `Pipeline / Page Layout / DB Schema` master models exist.

## Response shapes (unchanged contracts)

- RBAC: `{created_count, existing_count, created, existing, message}` (selective adds only the optional request field).
- Catalog: `{enabled_count, existing_count, enabled, existing, message}`.
