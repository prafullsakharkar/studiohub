# Organization Master Data Selective Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selective + Select All clone-from-master to all applicable Organization Workspace tabs while reusing the existing clone/config architecture.

**Architecture:** Extend `CloneMasterMixin` with optional `{master_ids}` (backward-compatible bulk when absent); add catalog `bulk-enable` on `OrganizationMasterDataViewSet`; upgrade `CloneMasterButton` to a selective modal; add missing catalog sub-tabs. No parallel architecture, no copy of catalog rows.

**Tech Stack:** Django REST Framework + `transaction.atomic` (backend, `../studiohub`, run with `uv run`); React 19 + TanStack Query + existing `ApiClient`/`Modal`/`SearchInput`/notification store (frontend, this repo); Vitest + pytest.

**Spec:** `docs/superpowers/specs/2026-10-02-org-master-data-design.md`

## Global Constraints

- Reuse before create: extend `CloneMasterMixin`, `clone_master_records`, `EntityTabShell`/`MasterDataTabShell`, `orgTabEntities`, existing query keys.
- RBAC entities copy-clone (independent org rows); catalog entities enable/config only — never copy catalog rows, never collapse the NULL-inherit tri-state in `config.py`.
- Clone is add-missing-only: never overwrite existing org records, never create duplicates; match by `(organization, code)`; idempotent under repeat and concurrent requests.
- Backend is authoritative for auth (authenticated → org membership → per-resource CREATE / `organization.master_data.configure`) and org isolation (`request.organization` / `organization_id` membership check; never trust client org IDs).
- Exclusions are allowlisted out: `Pipeline`, `Color`, `Theme`, `Page Layout`, `DB Schema` get no tabs, no endpoints, no generic clone path.
- Frontend uses the real Django REST API only — no MSW, mock data, or hardcoded results.
- Backend commands run with `uv run` (e.g. `uv run python manage.py test`); frontend checks are `pnpm test` / `vitest run`, `tsc --noEmit`, `vite build`.

## Review Focus

- Selective request with one already-cloned code + one new code creates only the new row and reports `created=1, existing=1` without touching the existing row.
- Concurrent double-submit of the same `master_ids` yields one row per code, second request reports all-skipped (no 500, no duplicate).
- `master_ids` containing a UUID from a sibling org's custom record or a soft-deleted/inactive master is rejected or skipped, never cloned.
- Catalog `bulk-enable` with an ID that already has a config row does not wipe existing overrides (only ensures `enabled=True`).
- Switching organizations in the workspace refreshes clone availability so org B never shows org A's codes as "already in organization".

---

### Task 1: Backend — selective `{master_ids}` on RBAC clone-master

**Files:**
- Modify: `../studiohub/backend/apps/organization/api/viewsets/clone_master.py`
- Modify: `../studiohub/backend/apps/organization/services/clone_master.py` (only if a helper is needed; prefer no change)
- Test: `../studiohub/backend/apps/organization/tests/api/viewsets/test_clone_master_selective.py` (new)

**Interfaces:**
- Consumes: `clone_master_records(*, masters, target_model, organization, build_kwargs) -> CloneResult` (existing, unchanged signature); `request.organization`; per-viewset `clone_source_model`, `clone_target_model`, `clone_label`, `clone_build_kwargs(master)`.
- Produces: `POST <resource>/clone-master/` accepting `{}` (all, legacy) or `{"master_ids": ["<uuid>", ...]}` returning `{created_count, existing_count, created, existing, message}` with HTTP 200; HTTP 400 for malformed/unknown IDs; HTTP 403 from existing permission map; HTTP 400 when `request.organization` is missing.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/organization/tests/api/viewsets/test_clone_master_selective.py
from apps.masterdata.models.platform import PlatformRole
from apps.organization.models import Organization, Role


def test_selective_clone_creates_only_selected(api_client, organization, org_admin):
    m1 = PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    m2 = PlatformRole.objects.create(name="Compositor", code="COMPOSITOR")
    m3 = PlatformRole.objects.create(name="Lighting", code="LIGHTING")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(m1.id), str(m3.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert res.data["created_count"] == 2
    assert Role.objects.filter(organization=organization, code__in=["animator", "lighting"]).count() == 2
    assert not Role.objects.filter(organization=organization, code="compositor").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python manage.py test apps.organization.tests.api.viewsets.test_clone_master_selective -v 2` (from `../studiohub/backend`)
Expected: FAIL (selective body currently ignored → clones all 3, `created_count == 3`).

- [ ] **Step 3: Write minimal implementation**

```python
# in CloneMasterMixin.clone_master, after resolving organization + models:
master_ids = request.data.get("master_ids", None) if isinstance(request.data, dict) else None
masters = source_model.objects.filter(is_deleted=False)
if hasattr(source_model, "is_active"):
    masters = masters.filter(is_active=True)
if master_ids is not None:
    if not isinstance(master_ids, list) or not all(isinstance(v, str) for v in master_ids):
        return Response({"detail": "master_ids must be a list of UUID strings."}, status=400)
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.forms.models import model_to_dict  # noqa: F401  (do not use; parse UUIDs below)
    import uuid as _uuid
    parsed = []
    for raw in master_ids:
        try:
            parsed.append(_uuid.UUID(str(raw)))
        except ValueError:
            return Response({"detail": f"Invalid master id: {raw}."}, status=400)
    masters = masters.filter(id__in=parsed)
```

Keep the rest of the method unchanged (delegate to `clone_master_records`, same message logic, same `result.as_response(message)`). Unknown IDs naturally yield zero rows → reported as no-ops; add an explicit `skipped_unknown` only if the serializer convention requires it (planner default: no new response keys to preserve contract).

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run python manage.py test apps.organization.tests.api.viewsets.test_clone_master_selective apps.organization.tests.api.viewsets.test_role_actions -v 1`
Expected: PASS.

- [ ] **Step 5: Add idempotency + permission + isolation tests to the same file**

```python
def test_reclone_is_idempotent(api_client, organization, org_admin):
    m = PlatformRole.objects.create(name="FX", code="FX")
    api_client.force_authenticate(org_admin)
    url = f"/api/organizations/{organization.id}/roles/clone-master/"
    headers = {"HTTP_X_ORGANIZATION_ID": str(organization.id)}
    first = api_client.post(url, {"master_ids": [str(m.id)]}, format="json", **headers)
    second = api_client.post(url, {"master_ids": [str(m.id)]}, format="json", **headers)
    assert (first.data["created_count"], second.data["created_count"]) == (1, 0)
    assert second.data["existing_count"] == 1


def test_clone_requires_org_admin(api_client, organization, non_admin_member):
    m = PlatformRole.objects.create(name="DMP", code="DMP")
    api_client.force_authenticate(non_admin_member)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(m.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 403
```

Run: `uv run python manage.py test apps.organization.tests.api.viewsets.test_clone_master_selective -v 1`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C ../studiohub add backend/apps/organization/api/viewsets/clone_master.py backend/apps/organization/tests/api/viewsets/test_clone_master_selective.py
git -C ../studiohub commit -m "feat(org): selective master_ids on clone-master"
```

### Task 2: Backend — catalog bulk-enable (no copy) + file-types config gap

**Files:**
- Modify: `../studiohub/backend/apps/masterdata/api/viewsets/organization.py`
- Modify: `../studiohub/backend/apps/masterdata/api/urls.py`
- Modify: `../studiohub/backend/apps/masterdata/models/__init__.py` (only if `OrganizationFileTypeConfig` is not exported; verify first)
- Test: `../studiohub/backend/apps/masterdata/tests/test_org_bulk_enable.py` (new; check existing `tests/` layout first and place beside org-masterdata tests)

**Interfaces:**
- Consumes: `CONFIG_MAP[data_type] -> (config_model, serializer_class, fk_field, parent_model)`; `_get_organization`, `_require_organization_access`, `_require_permission(user, org, "organization.master_data.configure")`.
- Produces: `POST /api/v1/organizations/{organization_id}/master-data/{data_type}/bulk-enable` with `{"ids": ["<uuid>", ...]}` → `{enabled_count, existing_count, enabled: [...], existing: [...], message}`; unknown `data_type` → 404; disallowed type → 404 (allowlist = the 7 catalog keys).

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/masterdata/tests/test_org_bulk_enable.py
from apps.masterdata.models import MasterTaskType


def test_bulk_enable_task_types(api_client, organization, org_admin):
    t1 = MasterTaskType.objects.create(name="Animation", code="ANIM")
    t2 = MasterTaskType.objects.create(name="Lighting", code="LIGHT")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable",
        {"ids": [str(t1.id), str(t2.id)]},
        format="json",
    )
    assert res.status_code == 200, res.content
    assert res.data["enabled_count"] == 2
    again = api_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/task-types/bulk-enable",
        {"ids": [str(t1.id)]},
        format="json",
    )
    assert again.data["enabled_count"] == 0
    assert again.data["existing_count"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python manage.py test apps.masterdata.tests.test_org_bulk_enable -v 2` (from `../studiohub/backend`)
Expected: FAIL with 404 (route does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```python
# in OrganizationMasterDataViewSet, add after create_custom:
@action(detail=False, methods=["post"])
def bulk_enable(self, request, organization_id=None, data_type=None):
    assert data_type is not None
    organization = self._get_organization(organization_id)
    self._require_organization_access(organization)
    self._require_permission(
        request.user, organization, self.CONFIG_PERMISSION,
        "Permission denied: cannot configure organization master data.",
    )
    entry = self.CONFIG_MAP.get(data_type)
    if entry is None:
        from rest_framework.exceptions import NotFound
        raise NotFound({"detail": "Unknown master data type."})
    config_model, _serializer_class, fk_field, parent_model = entry
    raw_ids = (request.data or {}).get("ids", [])
    if not isinstance(raw_ids, list) or not all(isinstance(v, str) for v in raw_ids):
        from rest_framework.response import Response
        return Response({"detail": "ids must be a list of UUID strings."}, status=400)
    import uuid as _uuid
    from django.db import transaction
    valid = parent_model.objects.filter(id__in=[_uuid.UUID(v) for v in raw_ids]).values_list("id", flat=True) if raw_ids else []
    valid_set = {str(v) for v in valid}
    enabled, existing = [], []
    with transaction.atomic():
        for raw in raw_ids:
            if raw not in valid_set:
                continue
            _obj, created = config_model.objects.get_or_create(
                organization=organization, **{fk_field: raw},
                defaults={"enabled": True},
            )
            if created:
                enabled.append(raw)
            else:
                existing.append(raw)
    from rest_framework.response import Response
    return Response({
        "enabled_count": len(enabled),
        "existing_count": len(existing),
        "enabled": enabled,
        "existing": existing,
        "message": "Master records enabled successfully." if enabled else "All selected records are already enabled for this organization.",
    })
```

Also add the missing file-types config entry to `CONFIG_MAP` (verify model field name first — default assumption):

```python
"file-types": (OrganizationFileTypeConfig, OrganizationFileTypeConfigSerializer, "file_type_id", MasterFileType),
```

with matching imports, and register the route in `urls.py`:

```python
path(
    "organizations/<uuid:organization_id>/master-data/<str:data_type>/bulk-enable",
    OrganizationMasterDataViewSet.as_view({"post": "bulk_enable"}),
    name="organization-master-data-bulk-enable",
),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run python manage.py test apps.masterdata.tests.test_org_bulk_enable -v 1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C ../studiohub add backend/apps/masterdata/api/viewsets/organization.py backend/apps/masterdata/api/urls.py backend/apps/masterdata/tests/test_org_bulk_enable.py
git -C ../studiohub commit -m "feat(masterdata): org bulk-enable for catalog types"
```

### Task 3: Frontend — API clients + clone hooks

**Files:**
- Modify: `src/api/masterDataApi.ts`
- Create: `src/modules/organization/hooks/useCloneMaster.ts`
- Test: `src/modules/organization/hooks/__tests__/useCloneMaster.test.tsx` (new; Vitest + Testing Library; mock `ApiClient` at the module boundary only — no MSW)

**Interfaces:**
- Consumes: `apiClient.post<T>(url, body)`; existing `CloneMasterResult` in `CloneMasterButton.tsx`.
- Produces: `masterDataApi.cloneOrgResource(orgId, resource, masterIds?: string[])`, `masterDataApi.bulkEnableCatalog(orgId, dataType, ids: string[])`, `useCloneMaster(orgId, resource)` returning `{ open, setOpen, candidates, selected, toggle, selectAll, clear, mutation, result }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/organization/hooks/__tests__/useCloneMaster.test.tsx
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client/ApiClient', () => ({
  apiClient: { post: vi.fn().mockResolvedValue({ created_count: 1, existing_count: 1, created: ['FX'], existing: ['ANIM'], message: 'ok' }) },
}));

import { masterDataApi } from '@/api/masterDataApi';

describe('cloneOrgResource', () => {
  it('sends master_ids for selective clone', async () => {
    const { apiClient } = await import('@/api/client/ApiClient');
    await masterDataApi.cloneOrgResource('org-1', 'roles', ['id-1', 'id-2']);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/organizations/org-1/roles/clone-master/',
      { master_ids: ['id-1', 'id-2'] },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/organization/hooks/__tests__/useCloneMaster.test.tsx`
Expected: FAIL (`cloneOrgResource` does not exist).

- [ ] **Step 3: Write minimal implementation**

```ts
// append to masterDataApi in src/api/masterDataApi.ts
cloneOrgResource: (organizationId: string, resource: 'roles' | 'groups' | 'departments' | 'positions', masterIds?: string[]) =>
  client.post<import('../modules/organization/components/CloneMasterButton').CloneMasterResult>(
    `/api/organizations/${organizationId}/${resource}/clone-master/`,
    masterIds && masterIds.length > 0 ? { master_ids: masterIds } : {},
  ),
bulkEnableCatalog: (organizationId: string, dataType: string, ids: string[]) =>
  client.post<{ enabled_count: number; existing_count: number; enabled: string[]; existing: string[]; message: string }>(
    `/api/v1/organizations/${organizationId}/master-data/${dataType}/bulk-enable`,
    { ids },
  ),
```

Keep the new `useCloneMaster.ts` hook thin in this task: selected-IDs state + mutation calling `cloneOrgResource`, invalidating `['organizations', orgId, resource]`, and mapping the result to the `"X added, Y already existed"` toast copy. Candidate fetching reuses existing list hooks (`useRoles`, `useAvailablePositions`, platform master hooks in `src/core/masterData/useMasterData.ts`) — no new fetching layer.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/organization/hooks/__tests__/useCloneMaster.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/masterDataApi.ts src/modules/organization/hooks/useCloneMaster.ts src/modules/organization/hooks/__tests__/useCloneMaster.test.tsx
git commit -m "feat(org): selective clone api client and hook"
```

### Task 4: Frontend — selective CloneMasterModal on Roles/Groups/Departments/Positions

**Files:**
- Create: `src/modules/organization/components/CloneMasterModal.tsx`
- Modify: `src/modules/organization/components/CloneMasterButton.tsx` (open modal instead of confirm-only; keep `label` prop verbatim and `{}` backward-compat path)
- Modify: `src/modules/organization/components/tabs/RolesTab.tsx`, `GroupsTab.tsx`, `DepartmentsTab.tsx`, `PositionsTab.tsx` (empty-state copy only where missing)
- Test: extend `src/modules/organization/components/tabs/__tests__/PositionsTabClone.test.tsx` + new `CloneMasterModal.test.tsx`

**Interfaces:**
- Consumes: `useCloneMaster(orgId, resource)` from Task 3; `Modal`, `Button`, `SearchInput`, `useNotificationStore`; platform master list + org list for Available/Already partitioning by normalized `code`.
- Produces: `<CloneMasterModal orgId resource label open onClose />` with search, per-row checkboxes, `Available` vs `Already in Organization` sections, `[Select All] [Clear Selection] [Cancel] [Clone Selected]`, result toast, post-clone invalidation.

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/organization/components/__tests__/CloneMasterModal.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloneMasterModal } from '../CloneMasterModal';

describe('CloneMasterModal', () => {
  it('disables already-cloned rows and clones only selected', () => {
    const onClone = vi.fn();
    render(
      <CloneMasterModal
        open
        onClose={() => {}}
        label="Master Roles"
        candidates={[{ id: '1', name: 'Animator' }, { id: '2', name: 'FX' }]}
        alreadyPresent={new Set(['animator'])}
        onClone={onClone}
      />,
    );
    expect(screen.getByText('Already in Organization')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Clone Selected'));
    expect(onClone).toHaveBeenCalledWith(['2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/organization/components/__tests__/CloneMasterModal.test.tsx`
Expected: FAIL (`CloneMasterModal` does not exist).

- [ ] **Step 3: Write minimal implementation**

Build `CloneMasterModal.tsx` on the existing `Modal` + `SearchInput` + `Button` pattern from `CloneMasterButton.tsx:94`: local `search` + `selected: Set<string>` state; rows filtered by name/code; rows whose normalized code is in `alreadyPresent` render `✓` disabled; `Select All` selects only available rows; `Clone Selected` calls `onClone([...selected])` and is disabled when empty. Keep `CloneMasterButton`'s permission gate (`can(CREATE_PERM[resource])`) and confirmation copy, replacing the confirm-only modal body with `<CloneMasterModal>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/organization/components/__tests__/CloneMasterModal.test.tsx src/modules/organization/components/tabs/__tests__/PositionsTabClone.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/components/CloneMasterModal.tsx src/modules/organization/components/CloneMasterButton.tsx "src/modules/organization/components/__tests__/CloneMasterModal.test.tsx"
git commit -m "feat(org): selective clone-from-master modal"
```

### Task 5: Frontend — catalog sub-tabs (asset/shot/review/file) + bulk-enable modal + states

**Files:**
- Modify: `src/modules/organization/components/tabs/MasterDataTab.tsx`
- Create: `src/modules/organization/components/tabs/masterData/OrgCatalogConfig.tsx` (generic sub-tab used for asset-types, shot-types, review-types, file-types; mirror `OrgTaskTypeConfig.tsx`)
- Modify: `src/core/masterData/useMasterData.ts` (add `useOrganizationCatalog(orgId, dataType)` only if the generic resolver hook does not already cover the new types)
- Test: `src/modules/organization/components/tabs/__tests__/OrgCatalogConfig.test.tsx` (new)

**Interfaces:**
- Consumes: `useOrganizationResolvedMasterData(orgId)` bundle + `bulkEnableCatalog(orgId, dataType, ids)` from Task 3; same modal/selection UX as Task 4.
- Produces: four new sub-tabs with counts, effective list, enable-toggle (existing `PUT config`), `Clone from Master` bulk-enable modal, custom-create entry point, and entity-aware empty state `"No {plural} available for this organization. Create a custom record or clone records from Master Data."`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/organization/components/tabs/__tests__/OrgCatalogConfig.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgCatalogConfig } from '../masterData/OrgCatalogConfig';

describe('OrgCatalogConfig', () => {
  it('shows entity-aware empty state', () => {
    render(<OrgCatalogConfig org={{ id: 'o1', name: 'Studio' }} dataType="asset-types" items={[]} />);
    expect(screen.getByText(/No asset types available for this organization\./i)).toBeInTheDocument();
    expect(screen.getByText('Clone from Master')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/organization/components/tabs/__tests__/OrgCatalogConfig.test.tsx`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Write minimal implementation**

Copy `OrgTaskTypeConfig.tsx` structure into generic `OrgCatalogConfig.tsx` parameterized by `dataType` (label map, `display_name`/`effective_color` fallbacks, enable toggle via existing `update*Config`, custom-create via existing `createCustom*` or the generic `create_custom` endpoint, bulk-enable modal from Task 4 wired to `bulkEnableCatalog`). Register the four sub-tabs in `MasterDataTab.tsx` with bundle-count badges. Exclude-list guard: sub-tab IDs come from a constant allowlist of the 7 catalog types — no `pipeline/color/theme/page-layout/db-schema` entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/organization/components/tabs/__tests__/OrgCatalogConfig.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/components/tabs/MasterDataTab.tsx src/modules/organization/components/tabs/masterData/OrgCatalogConfig.tsx src/modules/organization/components/tabs/__tests__/OrgCatalogConfig.test.tsx
git commit -m "feat(org): catalog sub-tabs with bulk enable"
```

### Task 6: Docs matrix + verification sweep

**Files:**
- Create: `docs/architecture/ORGANIZATION_MASTER_DATA.md` (this repo; mirror to `../studiohub/docs/architecture/ORGANIZATION_MASTER_DATA.md` if that folder exists)
- Modify: none (verification only)

**Interfaces:**
- Consumes: spec §3 matrix + as-built endpoint/component names from Tasks 1–5.
- Produces: published matrix table (Master Entity → Org Tab → CRUD → Selective → Select All → Dup protection) with the 5 exclusions marked N/A + allowlist note.

- [ ] **Step 1: Write the doc from the spec matrix, updated with as-built route/component names**
- [ ] **Step 2: Run full verification**

```bash
pnpm vitest run
pnpm exec tsc --noEmit
pnpm build
```

```bash
git -C ../studiohub status --short
(cd ../studiohub/backend && uv run python manage.py check && uv run python manage.py test apps.organization.tests.api.viewsets.test_clone_master_selective apps.masterdata.tests.test_org_bulk_enable -v 1)
```

Expected: all green (or a tracked list of pre-existing failures unrelated to this change).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/ORGANIZATION_MASTER_DATA.md
git commit -m "docs: organization master data clone matrix"
```
