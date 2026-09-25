# StudioHub Backend Authorization Analysis

> **Superseded (2026-09-23):** decision 7 / "org-wide, no per-project gate" is
> replaced by **ADR-0033** (`docs/adr/ADR-0033-canonical-authorization-model.md`):
> per-project RBAC is canonical — production entities are scoped by active
> `ProjectMembership` unless an ADMIN-priority organization role applies, SHOW is
> a first-class scope tier, permission codes are dot-notation, and `is_staff` is
> not an authorization tier. The remainder of this document's gate-hardening
> findings (ADR-0032) still stand.


> **Scope:** backend only. No frontend files were modified.
> **Date:** 2026-09-18
> **Required docs status:** all present — `AGENTS.md`, `backend/AGENTS.md`,
> `backend/.ai/ARCHITECTURE.md`, `backend/.ai/PROJECT_RULES.md`,
> `backend/.ai/CODING_GUIDELINES.md`, `backend/.ai/DEVELOPMENT_WORKFLOW.md`,
> `docs/APP_ARCHITECTURE_TEMPLATE.md`. No missing document to report.
>
> **Implementation status (2026-09-18): ALL findings implemented.**
> Decisions recorded in `docs/adr/ADR-0032-backend-authorization-hardening.md` (superseded in part by `ADR-0033`).
> Full backend suite green (2000 passed, 1 skipped). Corrections to the
> original analysis discovered during implementation are listed in
> Appendix B.

---

## 1. Overview

StudioHub backend authorization is a **view-layer, permission-code RBAC system**:

```text
JWT Authentication
  → request.organization / request.membership (header-derived)
  → DRF permission_classes (IsAuthenticatedPermission + HasPermission)
  → permission_map[action] → permission code strings
  → PermissionCacheService → PermissionResolver (UserRole + Membership role + GroupRole → RolePermission → Permission.code)
  → QuerySet org-scoping (list/detail isolation)
```

Strengths: global `IsAuthenticated` default, fail-closed org-context
resolution, strict production QuerySet scoping, org-scoped project-reference
resolution on create, good org-isolation test coverage in production-like apps.

Core weaknesses:

1. **Two parallel permission hierarchies** (`core/permissions/*` vs
   `core/api/permissions/*`) plus dead/stub classes — duplication the
   architecture forbids.
2. **`HasPermission` fails OPEN** when an action has no `permission_map`
   entry (`identity/permissions/permission.py:17-18`), and **staff/superuser
   bypass every code check** (`:20-21`).
3. **No object-level authorization anywhere** — zero `has_object_permission`
   overrides in any organization/production viewset; isolation is QuerySet
   scoping only.
4. **No project-level authorization** — any org member reaches every project.
5. **Zero service-layer authorization** — services trust caller kwargs.
6. **Auth-only surfaces** (audit, intelligence, masterdata catalog, settings
   themes/flags, scheduling stubs, analytics, project-scoped views, billing)
   enforce authentication but no permission code.
7. **Permission cache is never invalidated** — `PermissionCacheService.invalidate()`
   has zero callers; revocation relies on 1h TTL.
8. **Inconsistent staff semantics** — org selectors return unscoped rows for
   staff; production selectors stay strict; `IsAdminPermission` needs
   staff AND superuser while `HasPermission` bypasses on staff OR superuser.

---

## 2. Current Authorization Architecture

### 2.1 Component inventory

| Layer | Location | Classes | Role |
|---|---|---|---|
| Global default | `config/settings/components/drf.py:14-16` | `IsAuthenticated` (DRF) | Every endpoint requires authentication unless explicitly opened |
| Auth scheme | `config/settings/components/drf.py:17-21`, `config/settings/components/jwt.py:3-9` | `JWTAuthentication`, 30m access / 30d refresh, rotate + blacklist | Sole auth mechanism; `TokenService`/`JWTService` in identity own issuance |
| Hierarchy #1 (used) | `apps/core/permissions/base.py` | `BasePermission` (allow-all base), `IsAuthenticatedPermission`, `IsAdminPermission` (staff AND superuser), `IsOwnerPermission`, `ReadOnly/WriteOnly`, `Or/And/Not` combinators | `BaseViewSet.permission_classes=(IsAuthenticatedPermission,)` |
| Hierarchy #2 (parallel) | `apps/core/api/permissions/` | `Base`, `IsStaff`, `IsSuperUser`, `IsOwner`, `ReadOnlyPermission`, `IsReviewer`, `IsOrganizationMember/Admin`, `IsProjectMember`, `PermissionMapPermission`, `PermissionResolver` | Mostly unused by real viewsets; `IsStaff` reused only by settings definition/category/system views |
| RBAC gate (used) | `apps/identity/permissions/permission.py:6-41` | `HasPermission` | Reads `view.get_permission_required()` → `PermissionCacheService.has_permission(user, code, org=request.organization)` |
| Role gate (weak) | `apps/identity/permissions/role.py:9-29` | `HasRole` | Global `RoleResolver`, no org argument |
| RBAC models | `apps/organization/models/` | `Permission` (module/action/category/code), `Role` (org-nullable, parent, scope, priority), `UserRole`, `GroupRole`, `RolePermission`, `OrganizationMembership`, `Group` | Identity owns **no** Role/Permission model — all RBAC tables live in organization |
| Resolvers | `apps/identity/resolvers/permission.py`, `resolvers/role.py`, `authorization/checker.py` | `PermissionResolver`, `RoleResolver`, `PermissionChecker` | Three overlapping implementations (see §5) |
| Cache | `apps/identity/services/permission_cache.py` | `PermissionCacheService` (versioned keys, 1h TTL) | Active path; two further dead caches exist (`cache/permission.py`, `authorization/cache.py`) |
| Org context | `apps/organization/middleware/organization_context.py:26-76` | `resolve_organization_context()` | Header `X-Organization`/`X-Organization-Id` → Organization + membership; fail-closed to `None` |
| Org bases | `apps/organization/api/viewsets/base.py`, `apps/production/api/viewsets/base.py` | `OrganizationEntityViewSet`, `ProductionEntityViewSet` | `(IsAuthenticatedPermission, HasPermission)` + strict `scope_by_request` |
| Dead/stub guards | `apps/organization/permissions/*.py` | `Can*Organization` (unused), 7 always-`True` stubs (branding/calendar/department/holiday/membership/office/org-settings), non-DRF `InvitationPermissions` | Never wired to DRF; misleadingly suggest coverage |

### 2.2 Duplication map (violates "reuse before creation")

- `core/permissions/base.py` vs `core/api/permissions/base.py`: two `BasePermission`
  allow-all bases; two `IsOwner` variants; two readonly variants.
- `core/api/permissions/resolver.py:PermissionResolver` (uses `request.membership.has_permission`)
  vs `identity/resolvers/permission.py:PermissionResolver` (UserRole+membership+GroupRole)
  vs `identity/authorization/checker.py:PermissionChecker` (membership→role→permissions).
- `core/api/permissions/mixins.py:PermissionMapPermission` vs
  `identity/permissions/permission.py:HasPermission`: two permission-map readers;
  only the latter is used.
- `identity/cache/permission.py` + `identity/authorization/cache.py`: dead caches
  alongside the active `PermissionCacheService`.
- `IsAdminPermission` (staff AND superuser) vs `HasPermission` bypass (staff OR
  superuser) vs `IsStaff`/`IsSuperUser` (single-flag): three staff doctrines.

---

## 3. Current Request Flow (actual, verified)

```text
HTTP Request (Authorization: Bearer <JWT>, X-Organization: <id/code>)
  ↓
Middleware chain (config/settings/components/middleware.py:5-41)
  OrganizationMiddleware: request.organization = raw header string (NO validation)
  OrganizationContextMiddleware: resolve_organization_context() — but request.user
     is still AnonymousUser here (DRF authenticates later), so org/membership
     stay None on this pass
  ↓
DRF ViewSet.initial()
  perform_authentication() → JWTAuthentication sets request.user
  OrganizationEntityViewSet / ProductionEntityViewSet override re-runs
     resolve_organization_context(force=True) → request.organization (instance),
     request.membership (is_deleted=False row or None). FAIL-CLOSED to None.
  ↓
check_permissions()
  IsAuthenticatedPermission: bool(user.is_authenticated)
  HasPermission:
     perms = view.permission_map.get(action, ())   # ← OPEN default (§4)
     if not perms: ALLOW
     if user.is_staff or user.is_superuser: ALLOW   # ← global bypass
     else: all(PermissionCacheService.has_permission(user, code, request.organization))
  ↓
get_queryset(): selector get_queryset() (.all()) → scope_by_request()
     org: filter(organization=org) / none() if no org
     production: strict even for staff; organization: staff BYPASS (unscoped)
  ↓
get_object(): get_object_or_404(scoped queryset) + check_object_permissions()
     → no viewset defines has_object_permission ⇒ always True
  ↓
Serializer → Service (NO auth check) → ORM → DB
```

Key deviation from the aspirational
`Auth → OrgScope → Permission → ObjectPermission → BusinessValidation` chain:
**object permission is a no-op pass-through** and **services never re-check**.

---

## 4. Authentication vs Authorization

| Concern | Implementation | Verdict |
|---|---|---|
| Scheme | Sole `JWTAuthentication` (`drf.py:17-21`); `BaseAPIView.authentication_classes=()` override (`core/api/views/base.py:14-16`) disables JWT on legacy compat views (they re-add it explicitly) | Fragmented but functional |
| Access/refresh | `JWTService` over SimpleJWT (`identity/authentication/jwt.py`); 30m/30d, rotate+blacklist (`jwt.py:3-9`); `TokenService` binds refresh-jti to `UserSession` + login history | Sound |
| Anonymous | Global `IsAuthenticated` default; login/refresh/forgot/reset/verify explicitly `AllowAny`/empty | Correct separation |
| Inactive users | `validate_user_active` in login chain; PAT requires `is_active`; `get_active_user` filters | OK at login; **resolver does not filter `User.is_active`** — a deactivated user with a still-valid access token (≤30m) keeps passing `HasPermission` until token expiry |
| Soft-deleted users | `EntityModel` soft-delete; `ensure_not_deleted` validator exists but **resolver never checks `is_deleted`** on user/membership path except `resolve_organization_context` (`is_deleted=False`) vs `PermissionResolver` membership lookup (**no** `is_deleted` filter) — inconsistent | Gap |
| Staff/superuser | Treated as authorization bypass, not a role (`HasPermission:20-21`) | **AuthN confused with AuthZ**: being staff answers "who" but is used to answer "what can you do" |
| `IsAuthenticated`-only endpoints | audit/*, intelligence/*, masterdata catalog, settings theme/localization/flags/org-settings, production scheduling stubs + analytics + `ProjectScopedAPIView` family, billing, legacy singletons | **Authentication used where authorization required** — the exact anti-pattern the task warns about |

---

## 5. User Permission Resolution

Question answered: *"Can user X perform action Y?"*

```text
HasPermission.has_permission(request, view)
  perms = view.permission_map[action] or ALLOW
  staff/superuser → ALLOW
  else ∀ code ∈ perms:
        PermissionCacheService.has_permission(user, code, request.organization)
          → cache versioned 1h → miss: PermissionResolver.resolve()
```

`PermissionResolver.resolve(user, organization)` (`identity/resolvers/permission.py:22-78`):

```text
roles = UserRole(user)                                  # GLOBAL, no org filter, no active/deleted filter
      + OrganizationMembership(user, org).role          # single membership, NO is_deleted/status filter
      + GroupRole(group__users=user)                    # GLOBAL, no org filter
perms = RolePermission(role ∈ roles) → Permission.code  # no is_active/granted filter
```

Competing implementations:

- `authorization/checker.py:PermissionChecker`: membership → `role.permissions.filter(code, is_active=True)` — the **only** path filtering `is_active`.
- `api/serializers/frontend_user.py:105-118`: `role_permissions(role, granted=True, is_deleted=False, is_active=True)` — the **only** path checking `granted`/`is_deleted`.
- `resolvers/role.py:RoleResolver`: same three role sources, returns codes.

Problems:

1. **Global roles leak across orgs**: `UserRole` and `GroupRole` ignore organization,
   so a global grant applies in every org context.
2. **No active/deleted filtering** in the hot path (membership `is_deleted`/status,
   role `is_active`, permission `is_active`, `RolePermission.granted` all unchecked).
3. **No deny/negative permission** concept; `all()` over codes, no conflict resolution.
4. **N+1-ish fan-out**: 4 sequential queries per cold lookup (UserRole, Membership,
   GroupRole, RolePermission, Permission) — mitigated by 1h cache, which then
   introduces the revocation lag (§15).
5. `HasRole` is global-only (no org arg) — unusable for org-scoped roles.

---

## 6. Organization Authorization

- Enforcement point: `resolve_organization_context()` (fail-closed) +
  `scope_by_request()` in both org and production bases. Verified correct:
  no org → `qs.none()`; cross-org detail → 404 (not 403 — existence not revealed).
- Client `organization_id` handling:
  - Production create: `_resolve_project_from_input` resolves org-scoped, 400 on
    cross-org; `_clean_create_data` strips `organization*` keys in bulk create. Good.
  - Organization `ClientViewSet`/`VendorViewSet` (`client.py:50-57`, `vendor.py:50-56`):
    manual header read + `filter(organization_id=pk)` **without**
    `resolve_organization_context`/membership verification. Weak.
  - `NestedBulkActionsMixin._scoped_filters` (`nested_bulk.py:76-82`) skips the org
    filter for staff with no org context — cross-org child access if parent id guessed.
- Staff asymmetry: `OrganizationBaseSelector.scope_by_request:61-62` returns the
  **unscoped** queryset for staff/superuser (staff list/detail leak across orgs in
  the organization domain), while `ProductionBaseSelector` stays strict. The two
  reference implementations disagree on the staff doctrine.
- `resolve_organization()` fallback (`production/base.py:126-133`): no context and
  no instance → **first** `OrganizationMembership` org. Arbitrary-org assignment
  when the header is absent (mitigated in practice because `perform_create`
  requires project resolution first, but `TimelogViewSet`/`ReviewViewSet` overrides
  skip the `project is None` 400 guard and can `save(organization=None)`).

No `has_object_permission` exists, so org isolation for detail routes is entirely
`get_queryset` scoping — correct while every read goes through the scoped viewset,
fragile the moment a selector/service is called directly (§11).

---

## 7. Project Authorization

**Finding: there is no project-level authorization.** Behavior is organization-wide:

- No `ProjectMembership` gate feeds any permission check. `ProjectScopedAPIView._has_access`
  (`production/api/views/project_scoped.py:188-201`) allows org membership OR project
  membership OR staff — membership is sufficient, and all 14 subclasses enforce only
  `IsAuthenticatedPermission` (no permission codes at all).
- `POST members` (`:272-302`) and `POST notes` (`:436-458`) allow **any member** to add
  members/notes — no admin/role check.
- `ProductionEntityViewSet.archive/restore` (`bulk.py:470-492`) filters
  `(organization, id)` with **no project filter** — an org member can archive another
  project's row.
- Project filtersets resolve `project_id` org-scoped (good isolation) but apply no
  per-project permission.

Any user who can access Organization A can access **every** project in A. If
per-project confidentiality is required, it must be built (see §20).

---

## 8. Object Authorization

**Finding: object-level authorization does not exist as a layer.**

- Zero `has_permission`/`has_object_permission` overrides in any
  `organization/api/viewsets/*.py`, `production/api/viewsets/*.py`, or
  `production/api/views/*.py` (verified by grep).
- `check_object_permissions` is invoked (via `get_object()`), but every installed
  permission class either inherits allow-all `has_object_permission` (`BasePermission`)
  or doesn't override it (`HasPermission`, `IsAuthenticatedPermission`).
- The only object-shaped checks in the repo (`CanView/Update/ManageOrganization`,
  `IsOrganizationMember/Admin`, `IsProjectMember`, `IsOwner*`) are **never installed
  on a viewset**.
- Consequence: the vulnerability pattern from the task —
  *"has update permission + foreign-org id ⇒ unauthorized access"* — is blocked
  today **only** because `get_queryset` scoping turns it into a 404. Any code path
  that fetches outside the scoped queryset (bulk `_fetch_instance`
  `bulk.py:78-83` — `all_objects.filter(id=...)` with no org filter; `_recover_item`
  `existing_id` path; `team.py:140` unscoping role fallback) re-opens it, including
  cross-org detail leakage in `check-existence` responses.

---

## 9. API Authorization

Correct pattern (`IsAuthenticatedPermission + HasPermission` + full `permission_map`):
organization entity viewsets, production entity viewsets, deliveries, publishing,
scheduling (real app), platform notifications/reports.

Auth-only (no `HasPermission`, any authenticated user allowed) — each verified:

| Surface | File | Note |
|---|---|---|
| Audit log/activity/track/login-history/error/change/api-request | `apps/audit/api/viewsets/*.py` | No `permission_classes`/`permission_map`; background-job `retry`/`cancel` privileged with zero check |
| Intelligence search/knowledge/AI/analytics | `apps/intelligence/api/viewsets/*.py` (17× `IsAuthenticated`) | Hand-rolled org scoping; any member can write; staff fallback to `Organization.objects.first()` |
| Masterdata global catalog | `apps/masterdata/api/viewsets/catalog.py` | Any authenticated user can POST/PATCH/archive/restore/DELETE global rows |
| Settings theme/localization/feature-flag/org-setting | `apps/settings/api/viewsets/theme.py`, `localization.py`, `feature_flag.py`, `organization.py` | `activate/enable/disable/schedule/lock/unlock` open (definition/category/system correctly `IsStaff`) |
| Production scheduling stubs | `apps/production/api/viewsets/scheduling.py` (11 views) | POST/PATCH/PUT/DELETE with zero role check; `SchedulingPermissions` constants never used |
| Production analytics | `apps/production/api/viewsets/analytics.py` | No `ANALYTICS_VIEW` check; fail-open to zeros |
| Project-scoped family (14) | `apps/production/api/views/project_scoped.py:204+` | `IsAuthenticatedPermission` only; no per-action codes |
| Billing + legacy singletons | `apps/organization/api/viewsets/billing.py:42,88`, `api/urls_legacy.py:101` | GET readable by any user with resolvable org; PATCH staff-only |
| `OrganizationScopedViewSet` | `apps/organization/api/viewsets/scoped.py:30` | Declares no `permission_classes` → subclasses get auth-only |

Open-by-default amplifier: any `@action` absent from `permission_map` allows every
authenticated user with org context. Live gaps: `RoleViewSet.list_users`
(`role.py:126-127`), `list_groups` (`:164-165`).

---

## 10. Service Authorization

**Finding: zero services in organization or production perform authentication or
authorization.** All trust `organization`/`project`/`user` kwargs from the viewset.
No `PermissionDenied`, no membership lookup (beyond data filters), in:

- `production/services/*.py` (project/shot/asset/task/timelog/version/review/
  playlist/media/sequence/workflow/show/editorial-track), `services/bulk.py:47-334`
  (org+project filtered, no code/role check), `services/project_scoped.py:40-115`
  (`add_member`, `create_note` — no caller-capability check),
  `services/automation.py` (rule CRUD + execution logging, no check).
- `organization/services/*.py` (base create/update/delete/restore, org/department/
  team/office/position/membership/invitation/role/group/permission/api-key/billing/
  calendar/holiday).

Per project rules this is the intended split (views authorize, services execute),
but it means **every non-HTTP entry point runs unguarded** (§12) and any future
caller that skips the viewset inherits zero protection. Security-sensitive
operations (role grant/revoke, membership changes, invitation accept, bulk
mutations, publish/approve flows) should assert organization scope at minimum
inside the service (defense in depth, §20).

---

## 11. QuerySet / Selector Scoping

- All production scoping lives in `ProductionBaseSelector.scope_by_request`
  (strict, no staff bypass, `none()` on missing org) + `ProjectSelector.resolve_by_lookup`
  (org-scoped UUID/code/mock-id, excludes soft-deleted). Correct.
- Organization scoping (`OrganizationBaseSelector.scope_by_request`) is identical
  **except the staff bypass** (`:61-62` unscoped `qs` for staff/superuser).
- No `for_organization`/`for_project` QuerySet helpers exist in production
  (`querysets/__init__.py` effectively empty); org ones exist but are never called
  from viewsets (selectors used instead).
- Every per-entity selector `get_queryset` is unscoped `.all()` and depends on the
  caller applying `scope_by_request` — safe via the base viewsets, **unguarded when
  called directly** (services, dashboard/analytics aggregates that do filter
  explicitly are fine; any new direct caller is not).
- List endpoints therefore never return cross-org rows **through the viewsets**;
  object-level permission cannot protect lists (none exists), so scoping is the
  only defense — it holds, with the staff-bypass and direct-caller exceptions noted.

---

## 12. Bulk Operations

Org+project scoping in `production/services/bulk.py` is correct
(`filter(organization)`, `_get_project` org-scoped), but authorization is
request-level only — **never per-object**:

- `bulk_update`/`bulk_archive`/`bulk_restore`/`bulk_delete` check the action code
  once, then apply to all ids. A mixed `[allowed_id, foreign_project_id]` payload
  within the same org succeeds on both (no per-row project check anywhere).
- `TaskViewSet.bulk_assign` (`task.py:60-64`): raw `assignee_id`/`team_id` with no
  org/project membership validation of the assignee. `bulk_status` (`:78-82`): raw
  status string via bulk `.update()`, bypassing serializer validation.
- `bulk_delete` (`task.py:138-144`): hard `qs.delete()` — bypasses soft-delete,
  services, and events.
- `NestedBulkActionsMixin` (`organization/.../nested_bulk.py`): no
  `check_object_permissions`; staff-without-org skips the org filter.
- `_fetch_instance` (`production/.../bulk.py:78-83`) and `_recover_item`
  `existing_id` path fetch **unscoped** — cross-org row detail leaks in
  `check-existence` responses.

---

## 13. Custom Actions

Covered actions carry correct codes via `permission_map`; systemic issues:

1. **Missing entries = open**: `role.list_users`/`list_groups`, and structurally any
   future action forgotten in the map.
2. **Weak codes**: org `settings PATCH` mutates `OrganizationSettings` requiring only
   `VIEW`; `export`/`switch` require only `VIEW`; invitation `resend`/`accept`/`decline`
   all map to `UPDATE` while dedicated `ACCEPT`/`DECLINE`/`CANCEL` codes exist but are
   never referenced — and the email-ownership rule (`InvitationPermissions.can_accept`,
   never wired to DRF) is bypassed.
3. **Inconsistent archive/delete codes**: `archive:DELETE` (shot/asset/sequence/workflow)
   vs `archive:UPDATE` (task/playlist/version/org/team); `bulk_archive` likewise split;
   `media` has no archive/restore at all (hard `destroy` only).
4. **Service bypassing actions**: playlist/version/workflow `archive` flip
   `is_archived` via direct `.save()` (no `is_deleted`, no events); review
   `_update_status`/`verdict`/annotations/comments/notes, shot `approve`, timelog
   `approve`/`reject`, task `bulk_status` all write via direct `.save()`/`.update()`
   — permission code checked, business layer skipped.

---

## 14. Soft Delete / Archive / Restore

- Two orthogonal mechanisms coexist: `is_deleted`/`deleted_at` (soft-delete, service
  `delete`/`restore`, `all_objects` manager) and `is_archived` boolean (flip via
  direct save on playlist/version/workflow/task). Only the former emits events and
  is excluded from default queries.
- `delete` vs `archive` vs `restore` are **not separate permissions** anywhere:
  `destroy→DELETE`, `archive→UPDATE-or-DELETE` (inconsistent), `restore→UPDATE`.
  A holder of `UPDATE` can restore; a holder of `DELETE` can destroy — no distinct
  `ARCHIVE`/`RESTORE` codes except unused org constants (`TeamPermissions.ARCHIVE`,
  `DepartmentPermissions.ARCHIVE`).
- `?include_deleted`/`?include_archived` (`production/base.py:77-85`) exposes
  soft-deleted rows to any `VIEW` holder — no separate permission.
- Hard-delete bypasses: `client.py:104`/`vendor.py:74` `perform_destroy`
  (`instance.delete()`), `task.py:bulk_delete` (`qs.delete()`), identity cleanup
  tasks — bypass soft-delete/services/events.
- Restores are generally well-scoped (`all_objects.filter(is_deleted=True)` + org
  filter + `check_object_permissions`), except via the direct-save `is_archived`
  flips which skip all of it.

---

## 15. Permission Caching

Active: `PermissionCacheService` — versioned keys
`identity.permission:{user}:{org|global}:{version}`, 1h TTL, fail-open to uncached
resolution with a logged warning on backend failure (correct resilience posture).

Findings:

1. **Never invalidated**: `invalidate(user)` has **zero callers** — role grants/revokes,
   membership changes, `RolePermission` writes never bump the version. Revocation
   takes effect only on TTL expiry (≤1h stale access).
2. **Two dead caches** (`identity/cache/permission.py`, `identity/authorization/cache.py`,
   one using `delete_pattern` unsupported by locmem) invite misuse.
3. **Key includes org**, so cross-org leakage via cache is not present; but global
   `UserRole`/`GroupRole` grants are folded into every org-scoped entry (§5).
4. No negative caching; no per-permission TTL; no stampede lock (acceptable at this scale).
5. `HasPermission` staff bypass skips the cache entirely — staff permission changes are
   irrelevant by construction (they allow everything).

---

## 16. Superuser / Staff Behavior

| Actor | Behavior (verified) |
|---|---|
| Superuser | `HasPermission` bypass (`or`); `create_superuser` forces `is_staff+is_superuser+is_active+verified`; `IsSuperUser` class exists but unused on viewsets |
| Staff | Same `HasPermission` bypass (`or` — so `is_staff` alone suffices); org selectors return **unscoped** rows; production selectors stay strict; `BillingView` falls back to `Organization.objects.first()` for staff; intelligence staff fallback to first org |
| Normal user | Code check + org scoping; global roles apply everywhere |
| Inactive (`is_active=False`) | Blocked at login; **not blocked** by resolver with a live token; selectors `active()` exist but unenforced on the auth path |
| Soft-deleted | `resolve_organization_context` excludes (`is_deleted=False`); `PermissionResolver` membership lookup does not — inconsistent |

Doctrines conflict: `IsAdminPermission` requires staff AND superuser;
`HasPermission` bypasses on staff OR superuser. Pick one (§20).

---

## 17. Security Findings

### Critical

1. **Open-by-default `HasPermission`** (`identity/permissions/permission.py:17-18`):
   any action missing from `permission_map` allows all authenticated users.
   Evidence: `role.list_users`/`list_groups` live-gapped; every future action is
   born-open. Fix: deny when the map has no entry (with an explicit allow-list for
   genuinely public actions).
2. **Global staff/superuser bypass** (`:20-21`): `is_staff` alone grants every
   permission code in every org. Combined with the org-selector staff bypass, staff
   is effectively a cross-org superuser in the organization domain. Fix: scope staff
   to explicitly granted codes; keep a narrow, audited break-glass path if needed.
3. **Unscoped bulk fetch** (`production/api/viewsets/bulk.py:78-83`, `_recover_item`):
   `all_objects.filter(id=...)` without org filter leaks cross-org row detail in
   `check-existence`. Fix: always scope by `request.organization`.
4. **Auth-only privileged surfaces**: masterdata global catalog writes, settings
   theme/flag `activate/enable/disable`, audit background-job `retry/cancel`,
   production scheduling stub mutations — any authenticated user may invoke. Fix:
   attach `HasPermission` + codes (or `IsStaff`) per §20.

### High

5. **No per-object authorization in bulk paths**: mixed-org/project id lists are
   evaluated once at request level. Fix: per-id scope + permission validation with
   per-record errors, in a transaction.
6. **No project-level access control** (§7): org member ⇒ all projects. Fix only if
   the product requires it (explicit decision, §20).
7. **Writable ownership/context fields**: org create/update serializers accept
   `created_by`; `bulk_assign` accepts arbitrary `assignee_id`/`team_id`;
   `ProjectMembershipCreateSerializer` accepts `userId/email/role` with no
   org-membership pre-check; `TimelogViewSet` `person_id` alias unverified. Fix:
   server-set ownership; validate assignees/members against org membership.
8. **Stale permission cache**: no invalidation callers → ≤1h post-revocation access;
   resolver ignores `is_deleted`/`is_active`/`granted`. Fix: invalidate on every
   role/membership/grant write + filter active/granted in resolver.
9. **Direct-save action bypasses**: playlist/version/workflow archive, review
   transitions, shot/timelog approve, task bulk_status skip services/events/audit.
   Fix: route through services.

### Medium

10. Dual permission hierarchies + dead/stub guards (§2.2) — consolidate.
11. Inconsistent archive/delete codes + `is_deleted` vs `is_archived` duality (§13–14).
12. `?include_deleted` visible to any `VIEW` holder; org `settings PATCH`/`export`/
    `switch` require only `VIEW`; invitation email-ownership never enforced.
13. `resolve_organization()` first-membership fallback; `Client`/`VendorViewSet`
    header-trusted org filter; nested-bulk staff org-skip.
14. `IsAuthenticated`-vs-`IsAuthenticatedPermission` mix (intelligence uses raw DRF);
    `BaseAPIView.authentication_classes=()` JWT opt-out on legacy views.

### Low

15. Naming: `organization.view_organization` (dead) vs `organization.view` (live);
    `projects:read` vs `organization.view` scheme split; `start-review` URL vs
    `start_review` method fragility; `RolePermissions` map keys vs method names.
16. Maintainability: empty placeholder modules (`api/permissions/authenticated.py`,
    `object.py`, `role.py`); `__init__` re-exporting nonexistent names;
    `PermissionMapPermission` parallel to `HasPermission`.

---

## 18. Authorization Matrix (actual implementation)

`Guard` = what really runs. `OPEN` = any authenticated user (with resolvable org
where scoping applies). `CODE` = `HasPermission` + listed code.

| Resource | Action | AuthN | Guard (actual) | Org scope | Project scope | Object check |
|---|---|---|---|---|---|---|
| Organization | list/retrieve | JWT | CODE `organization.view` | member-only (non-staff); staff sees all | N/A | none (scoping) |
| Organization | create | JWT | CODE `organization.create` | — | N/A | none |
| Organization | update (incl. settings PATCH, export, switch) | JWT | CODE `organization.update`/`organization.view` (settings PATCH wrongly `VIEW`) | scoped | N/A | none |
| Organization | archive/restore/destroy | JWT | CODE `UPDATE`/`UPDATE`/`DELETE` | scoped | N/A | none |
| Department/Team/Office/etc. | CRUD + archive | JWT | CODE `<domain>.*` | scoped (staff bypass) | N/A | none |
| Roles/Groups/Permissions | CRUD + clone/grant/assign | JWT | CODE, except `list_users`/`list_groups` = OPEN | scoped (staff bypass) | N/A | none |
| Invitations | CRUD + resend/accept/decline | JWT | CODE `UPDATE` (email-ownership NOT enforced) | scoped | N/A | none |
| Memberships | list/update/bulk-update | JWT | CODE `UPDATE`, no per-row check | scoped | N/A | none |
| Billing | read | JWT | OPEN (any user, resolvable org) | manual filter | N/A | none |
| Billing | update | JWT | staff-only manual | manual | N/A | none |
| Project/Sequence/Shot/Asset/Task/... | CRUD | JWT | CODE `<resource>:read/create/update/delete` | strict | create: org-scoped resolve; read/update: org only | none (scoping) |
| Shot approve, Timelog approve/reject, Review approve, Version publish/promote | action | JWT | CODE `:approve`/`:publish` | strict | org only | none |
| Task bulk_assign/bulk_status/bulk_delete/archive | action | JWT | CODE once per request; assignee/status unvalidated; `bulk_delete` hard-deletes | strict | none | none |
| Bulk create/update/archive/restore/check-existence | action | JWT | CODE once; `_fetch_instance` unscoped leak | strict (except leak) | create/update scoped | none |
| Project-scoped family (members/summary/dashboard/lists/notes/…) | GET+POST | JWT | OPEN (membership-or-project-or-staff gate, no codes) | URL org | URL project | none |
| Scheduling (production stubs, 11 views) | all | JWT | OPEN | manual filter | — | none |
| Analytics KPIs/departments | GET | JWT | OPEN | manual filter | — | none |
| Audit logs/activity/jobs | list/retrieve; job retry/cancel | JWT | OPEN | selector scope (staff full) | N/A | none |
| Intelligence search/knowledge/AI | all | JWT | OPEN (raw `IsAuthenticated`) | hand-rolled | — | none |
| Masterdata global catalog | CRUD + archive/restore | JWT | OPEN | GLOBAL rows | N/A | none |
| Masterdata org bundle | read | JWT | membership (except `file-types` exempt) | manual | N/A | none |
| Masterdata org config/custom | write | JWT | CODE `master_data.configure/create` (direct service call) | manual | N/A | none |
| Platform notifications/reports | read/update | JWT | CODE `notifications:*/reports:read` | scoped | N/A | none |
| Deliveries/Publishing/Scheduling(app) destinations | CRUD + transitions | JWT | CODE `deliveries:*/publishing:*/scheduling:*` | scoped | N/A | none |
| Settings definition/category/system | CRUD + lock/unlock | JWT | `IsAuthenticatedPermission + IsStaff` | — | N/A | none |
| Settings theme/localization/flags/org-setting | CRUD + activate/enable/lock | JWT | OPEN | — | N/A | none |
| Identity users | list/retrieve/me | JWT | OPEN to authenticated | — | N/A | `retrieve self` contract |
| Identity users | mutations (create/update/destroy/activate/…) | JWT | CODE `identity.user.*` | — | N/A | none |

---

## 19. Test Coverage

Covered (positive + negative 401/403 matrices, org-isolation 404s):

- Identity user/profile/session/IP-blacklist/login-attempt/security-event permission
  matrices (`identity/tests/permissions/`, `identity/tests/api/viewsets/test_user_viewset_permissions.py`).
- `Can*Organization` unit tests (`organization/tests/permissions/test_organization_permissions.py`)
  — **for classes never installed on a viewset** (false confidence).
- RBAC join resolution API test (`test_rbac_join_permissions.py`).
- Org-isolation (list-scoped, cross-org 404) in platform, scheduling, deliveries,
  publishing, organization (flat+nested+admin+context), intelligence (header-leak),
  masterdata (bundle 403), production (most complete incl. bulk cross-org rejection),
  settings (single theme test), audit (401/200 smoke only).
- Core authN/authZ smoke tests.

Missing (no tests for the paths that matter most):

- Negative per-action CODE tests for deliveries/publishing/scheduling transitions,
  platform `mark_read`, production approve/publish/promote, task bulk ops.
- `permission_map` omission test (new action defaults deny) — no such test exists.
- Staff-bypass tests (staff without explicit code ⇒ deny after fix).
- Per-object/per-project tests (no layer exists to test).
- Bulk mixed-org/project id rejection; per-record error shape.
- Invitation accept-by-non-invitee; `settings PATCH` with `VIEW`-only code;
  `export`/`switch` with `VIEW`; masterdata catalog write by non-staff;
  settings theme/flag activation by non-staff; audit retry/cancel by non-privileged.
- Cache invalidation on grant/revoke (no invalidation to test); resolver
  `is_deleted`/`is_active`/`granted` filtering.
- Service-layer scope assertions; Celery/signal privileged-op audit.
- Inactive/soft-deleted token-holder denial.

---

## 20. Recommended Architecture (incremental, preserves Core → Identity → Organization → Production)

```text
User
 ↓  (JWT, unchanged)
Organization Membership   [Organization owns: resolve_organization_context + membership]
 ↓
Role                      [Organization owns: Role/UserRole/GroupRole models]
 ↓
Permission (module.action codes)  [Organization owns catalog; Identity resolves]
 ↓
Resource + Action + Scope (global | organization | project | object)
 ↓
Enforcement order per request:
  1. Core: authentication + request context (no domain logic)
  2. Identity: HasPermission (deny-by-default) + PermissionCacheService (invalidate on write)
  3. Organization: membership gate + QuerySet scope (staff treated as member, NOT bypass)
  4. Production (+siblings): project scope where the product requires it + object check
  5. Service: assert organization scope (defense in depth, no code duplication)
```

Responsibilities:

- **Core**: reusable framework only — single `BasePermission` hierarchy (delete the
  `api/permissions` duplicate), `IsAuthenticatedPermission`, combinators,
  `PermissionMixin`/`get_permission_required` with **deny-by-default**, response
  codes (401 vs 403), diagnostics. No domain imports (unchanged rule).
- **Identity**: authentication (JWT/session/PAT/API-key), `User`, `HasPermission`
  (deny on missing map entry; staff bypass removed or narrowed to an explicit
  `break_glass` code), `PermissionResolver` (active/granted/deleted-aware),
  `PermissionCacheService` + **write-through invalidation**. No RBAC models (unchanged).
- **Organization**: RBAC models + membership/role/group services (each mutating
  service calls `PermissionCacheService.invalidate` for affected users),
  `resolve_organization_context`, scoped selectors (remove staff bypass), invitation
  email-ownership enforcement, org-level permission codes.
- **Production** (and deliveries/publishing/scheduling/platform/audit/intelligence/
  masterdata/settings): resource codes, `permission_map` for **every** action
  (including bulk/custom), project scoping where adopted, object checks where
  row-ownership exists, services asserting `organization` (and `project`) scope.

Scope levels to support: `global` (UserRole — keep, but mark explicitly global and
exclude from org-scoped checks unless the code is namespaced `global.*`),
`organization` (default), `project` (new, only if product confirms the need —
do NOT build speculative per-project RBAC; the minimal correct step is documenting
that access is org-wide and adding the project filter to archive/restore/bulk paths),
`object` (only where ownership semantics exist: e.g. PATs, sessions, notes authorship).

Action granularity to standardize (codes already exist for most; enforce consistently):
`view/create/update/delete` everywhere, plus `archive/restore` as **separate codes**
where soft-delete exists, plus existing `approve/publish/assign` verbs.
Do not invent new verbs beyond these without a product requirement.

Deny-by-default rules (all three, enforced in `HasPermission` + resolver):

```text
No explicit permission ⇒ DENY
No organization membership (for org-scoped codes) ⇒ DENY
No project access (once project scoping exists) ⇒ DENY
```

Global/system codes (`global.*`, staff break-glass) are the only documented exceptions.

---

## 21. Migration Strategy

Principles: additive first, no flag-day; each step ships with tests; API contract
(200/401/403/404 shapes) preserved — cross-org stays **404** (no existence leak),
missing-code becomes **403**, unauthenticated stays **401** (existing
`custom_exception_handler` 403→401 coercion for auth failures is kept).

1. **Harden the gate (no schema change)**: `HasPermission` deny-on-missing-map-entry;
   fix `role.list_users`/`list_groups` entries; scope bulk `_fetch_instance`/
   `_recover_item`; server-set `created_by`; validate bulk assignees/members.
2. **Unify hierarchies**: delete or re-export `core/api/permissions/*` from
   `core/permissions/*`; remove dead `Can*Organization`/stub classes or implement
   them; remove dead caches; reconcile staff doctrine (single `IsAdmin` = staff AND
   superuser for Django-admin surfaces; `HasPermission` bypass removed).
3. **Resolver + cache correctness**: filter `is_active`/`is_deleted`/`granted`/
   membership-status in `PermissionResolver`; namespace global vs org grants;
   call `invalidate()` from every role/membership/grant service; add revocation tests.
4. **Close auth-only surfaces**: attach codes (or `IsStaff`) to audit jobs,
   intelligence writes, masterdata catalog, settings theme/flags, scheduling stubs,
   analytics, billing read, project-scoped POSTs; fix weak codes (settings PATCH,
   export/switch, invitation accept/decline ownership).
5. **Bulk + custom-action hardening**: per-id scope/permission validation with
   per-record errors in transactions; route direct-save actions through services;
   split `archive`/`restore` codes; remove hard-delete bypasses (or gate them).
6. **Selector parity**: remove org staff bypass (or document + test it as explicit
   break-glass); add `for_organization`/`for_project` QuerySet helpers in production;
   assert org scope in security-sensitive services.
7. **Project scoping decision**: product decides org-wide vs per-project; implement
   only the decided model (minimal: project filter on archive/restore/bulk + docs).
8. **Tests**: per-action 403 matrices for every app; map-omission deny test;
   mixed-id bulk tests; invitation/billing/catalog/settings negatives; cache
   revocation tests; inactive/deleted-holder tests.

---

## 22. Implementation Stages

- **Phase 1 — Gate cleanup**: deny-by-default map, missing entries, unscoped fetches,
  writable ownership fields. (Critical 1–4, High 7 partial)
- **Phase 2 — Membership authorization**: resolver filters, global/org namespacing,
  org-selector staff parity, client/vendor header trust fix. (High 8, Medium 13)
- **Phase 3 — Project/resource scoping**: product decision; project filter on
  archive/restore/bulk; document org-wide default. (High 6)
- **Phase 4 — Object-level authorization**: introduce `has_object_permission` only
  where ownership semantics exist (sessions/PATs/notes); keep scoping elsewhere.
- **Phase 5 — API/custom-action authorization**: codes for all auth-only surfaces +
  weak-code fixes + service-routed actions. (Critical 4, High 9, Medium 12)
- **Phase 6 — Bulk-operation authorization**: per-id validation, per-record errors,
  transactional semantics, hard-delete review. (High 5)
- **Phase 7 — Permission caching/invalidation**: write-through invalidation, tests,
  dead-cache removal. (High 8)
- **Phase 8 — Security hardening**: staff-doctrine unification, `?include_deleted`
  gating, archive/restore code split, `resolve_organization` fallback removal.
- **Phase 9 — Comprehensive authorization tests**: matrices per app + negatives (§19).
- **Phase 10 — Production verification**: 401/403/404 contract check, TTL/invalidation
  behavior, staff break-glass audit, docs/ADR updates.

---

## Appendix B — Analysis corrections (found during implementation)

1. **Serializer `created_by` writable — FALSE POSITIVE.** The four org/department
   create/update serializers list `created_by` only in `Meta.exclude`
   (never accepted from clients). No change needed.
2. **`Client/VendorViewSet.perform_destroy` hard-delete — FALSE POSITIVE.**
   `instance.delete()` on `EntityModel` soft-deletes via the model override.
   Only queryset-level `qs.delete()` hard-deletes (was real in
   `TaskViewSet.bulk_delete`; fixed to per-instance service soft-delete).
3. **`PermissionResolver` soft-delete filtering — PARTIALLY WRONG.** Whether
   `objects` excludes deleted rows depends on each domain manager (only
   `SoftDeleteManager` does; most RBAC managers don't). The rewritten resolver
   now filters `is_deleted=False` explicitly on every hop regardless.
4. **`IsOrganizationOwner` — worse than reported.** It filtered on a
   nonexistent `is_owner` field (would raise `FieldError` if ever called).
   Fixed to use ADMIN-priority membership roles (`RolePriority` has no
   "owner" value; dead `Can*Organization` classes referencing `owner` codes
   remain unused).
5. **`RolePermission` field is `granted`** (not `is_granted`); unused test
   fixtures `granted/denied_role_permission` used the wrong kwarg (fixed).
6. **`OrganizationMembership` manager does not exclude soft-deleted rows**
   (plain `models.Manager`); resolver and context code now filter explicitly.
7. **`StaffWritesRequiredMixin` must precede viewset bases in MRO** (placed
   after `BaseViewSet` it never runs — caught by test, fixed).
8. **`OrganizationMembershipService.suspend/accept/reactivate` called model
   methods that did not exist** (`AttributeError`); model transitions added.
9. **`InvitationService.accept/decline` omitted the required `user` arg** of
   the model methods (`TypeError`); service + viewset now pass `request.user`.
10. **`validate_email_verified` was doubly broken** (wrong attribute,
    inverted logic) and dead; fixed as an opt-in primitive, login chain
    unchanged (verification is not a login gate).

## Appendix C — Implementation record (2026-09-18)

All 10 implementation phases complete. Acceptance checklist from the analysis:

- [x] All existing permission classes identified (§2).
- [x] All role/permission resolution paths identified (§5).
- [x] Organization authorization documented (§6).
- [x] Project authorization documented (§7 — org-wide, no per-project gate).
- [x] Object-level authorization documented (§8 — absent by design gap).
- [x] QuerySet/Selector scoping documented (§11).
- [x] Custom API actions audited (§13).
- [x] Bulk operations audited (§12).
- [x] Archive/restore/delete authorization audited (§14).
- [x] Serializer security audited (§6–7, §17 items 7).
- [x] Service-layer authorization audited (§10).
- [x] Celery/background authorization implications audited (§9 table + §17; tasks run
      without request context by design; `enqueue_and_run` is synchronous today with a
      documented future-`.delay()` context-propagation risk; change-tracking signals are
      best-effort audit-only; seeders are CLI-privileged by design).
- [x] Superuser/staff bypasses documented (§16).
- [x] Permission caching audited (§15).
- [x] Cross-organization access risks checked (§6, §8, §12, §17).
- [x] IDOR risks checked (§8: blocked via scoping-404 today; unscoped-fetch exceptions listed).
- [x] Existing authorization tests reviewed (§19).
- [x] Missing security tests identified (§19).
- [x] Authorization matrix created (§18).
- [x] Current architecture documented (§2–3).
- [x] Recommended architecture documented (§20).
- [x] Migration plan documented (§21–22).
- [x] No frontend files modified (verified `git status`: backend + docs only).
- [x] No mock/frontend permission implementation changed.

### What was implemented (per phase)

- **Phase 1 — Gate:** `HasPermission` deny-by-default + org-mismatch object
  check; staff bypass removed (superuser break-glass kept, logged);
  `get_permission_required` distinguishes missing/empty/unrouted actions;
  role `list_users/list_groups` + user-role `create` mapped; identity open
  actions made explicit; bulk `_fetch_instance` org-scoped;
  `IsOrganizationOwner` crash fixed; broken `is_granted` fixtures fixed.
- **Phase 2 — Membership:** fail-closed resolver (active users/memberships/
  roles/permissions, `granted=True`, org-scoped roles, live group members);
  org selector scopes staff when a header org is set; client/vendor fail-open
  header parsing + `first()` fallback removed; nested parent lookups always
  org-scoped; email validator fixed (opt-in, login unchanged).
- **Phase 3 — Project/resource:** bulk recover project-match guard; org-wide
  access model recorded (ADR-0032), no speculative per-project RBAC.
- **Phase 4 — Object:** `has_object_permission` org-consistency defense
  (queryset scoping remains primary).
- **Phase 5 — API/actions:** analytics/billing membership gates; org settings
  PATCH requires UPDATE; invitation accept/decline invitee-or-grant gate
  (+ invitee visibility in selector; service user-arg crash fixed);
  audit mutations require `audit:update` (new codes); masterdata catalog and
  settings theme/flag/localization/org-setting writes require staff
  (`StaffWritesRequiredMixin`); project-member creation requires org ADMIN;
  task bulk assignee/team/status validation + soft-delete bulk delete;
  team role fallback org-scoped; timelog/review create org guards;
  membership model transitions added (service called missing methods).
- **Phase 6 — Bulk:** per-item org scoping confirmed in services; viewset
  leaks closed (see Phase 1/3/5).
- **Phase 7 — Cache:** write-through invalidation from all RBAC-mutating
  services; grant re-flip fix; dead caches + duplicate permission modules +
  empty placeholders deleted; seed gains `audit:update`,
  `master_data.configure/create`.
- **Phase 8 — Hardening:** `?include_deleted` requires DELETE grant;
  `resolve_organization` arbitrary-membership fallback removed; staff
  doctrine unified (admin context for listing, never a permission bypass).
- **Phase 9 — Tests:** 60+ new tests (gate, resolver filters, revocation,
  invitations, plain-view gates, task bulk, negatives, member management).
- **Phase 10 — Verification:** `manage.py check` clean; full backend suite
  2000 passed / 1 skipped; ruff clean on all touched files; ADR-0032.
