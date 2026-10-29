# User-Based Organization Access + Single-org Auto-select — Design Spec

Date: 2026-10-05
Status: Design approved (pending spec-file review)
Scope: `studiohub-react` (frontend) + `../studiohub` (backend)
Approach: gap-closure pass on top of v3.7.0/v3.8.0 (strict access + nav
consolidation already landed); no second auth system; no frontend-only
enforcement.

## 1. Rule (carried forward verbatim)

- `is_superuser === true` → all organizations everywhere.
- `is_superuser === false` → active, non-deleted `OrganizationMembership`
  only. `is_staff` counts like a normal user per ADR-0032/0033.
- **0 orgs** → no org loaded; empty/permission state; no org-scoped fetches.
- **Exactly 1** → auto-select on bootstrap; org dropdown hidden entirely —
  only the project dropdown stays.
- **2+** → org switcher restricted to accessible orgs; project dropdown after
  it.

## 2. Ground truth (already landed — do not re-do)

Backend: `OrganizationViewSet.get_queryset` membership scope; IDOR matrix on
nested + flat routes (write gates on client/vendor create/restore + parent
resolution); masterdata superuser break-glass in `_require_organization_access`.
Frontend: `OrganizationContext` server-filtered directory; switcher lock at
single-org; boot revalidation of persisted org; scoped palette/search; cascade
on switch (`queryClient.clear()` + project reset); strict `isPlatformSuperuser`
and engine/org-path label-bypass removals.

Previous release docs cover this at `docs/architecture/ORGANIZATION_ACCESS.md`.

## 3. Residual gaps this spec closes

### 3.1 Backend — alias endpoints (locked decision)

- `/api/v1/organization/organizations/` (legacy singular) and
  `organizations/my/` style aliases: **delete or strip to redirects to the
  canonical endpoints** — remove, don't duplicate enforcement.
- `has_organization_access` is the only gate; keep 200-empty for scoped list
  queries (locked decision: selector-scoped lists stay server-side; 403/404
  reserved for detail/write targets that identify a resource by ID/header).
- Membership revocation → immediate effect (invalidate cache on removal;
  verify in tests).

### 3.2 Frontend — selection state machine (tightened)

- `OrganizationContext` derives `accessibleOrganizations` from
  `/api/v1/auth/me/organizations/` (memberships) + `/api/v1/auth/me/`
  (`is_superuser`). Persisted `studiohub_active_org_id` validates on bootstrap,
  gets discarded on revocation. Exactly-1 rule + project-dropdown-only UI
  holds always (header never renders org switcher at size ≤ 1).
- Existing fallbacks (`currentOrganization || 'org-apex-01'`) are removed
  where an org-bearing component must not render without a real current org
  (`AccessOverviewSection`'s hardcoded fallback is the known example).
- Logout and user change also clear the query cache + persisted org.

### 3.3 Version / environment from real source

- Add `GET /api/v1/info/version/` (public, returns `{version: string,
  environment: 'production'|'staging'|'development', commit?: string}` from
  Django settings) and read it in the header instead of hardcoded copies.

### 3.4 Tests (fill gaps from previous DoD)

- Backend: org aliases no longer resolve; membership+superuser matrices
  on canonical endpoints; search/knowledge with inaccessible targets;
  immediate revocation (flip membership `is_deleted=True` / `status` and
  retry) — `403/404` everywhere the contract says so.
- Frontend (vitest): 0-org → empty state with zero org-scoped network
  calls; 1-org → no switcher button and auto-select; 2+ → switcher with
  exactly those orgs; superuser → all orgs; stale persisted org discarded;
  logout clears cache.
- E2E: expand `seed_dev.py` to add a second org + memberships so the
  previously `test.fixme`d switcher/superuser/badge flows run for real.

### 3.5 Docs

Update `docs/02-architecture/authorization.md`, `docs/api/permissions.md`
to reflect: alias deletion, rule of 0/1/2+ orgs in the UI, 200-empty vs
403/404 decision for list vs detail/write, version endpoint.

## 4. DoD

In addition to all the previously landed acceptance checks, this task
closes:

- [ ] Legacy org aliases removed from the URL surface (delete, not preserve).
- [ ] Membership-only scoping on all canonical org endpoints and a no-regression 200-empty for non-member list reads.
- [ ] Auto-select on exactly 1 org; no switcher in DOM at 1 org; switcher only at ≥2.
- [ ] 0-org blocks org-scoped data requests AND renders the empty state.
- [ ] Logout/user change clears query cache and persisted org selections.
- [ ] Hardcoded org fallbacks removed where a missing org must not resolve.
- [ ] Version/environment rendered from `/api/v1/info/version/`.
- [ ] Backend + frontend + e2e suites pass (with multi-org e2e no longer fixme'd).
- [ ] ADR-0033 decision text matches the code.
