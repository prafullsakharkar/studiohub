# Organization Dependency Audit — StudioHub

**Date:** 2026-10-14
**Scope:** Entire codebase — backend Django monorepo (`studiohub/backend`, 12 apps) and React frontend (`studiohub-react`).
**Method:** Read-only inspection of models, viewsets, selectors, services, middleware, permissions, tasks, caches, routes, hooks, and stores. No code modified.
**Related docs:** `ORGANIZATION_ACCESS.md`, `ORGANIZATION_MASTER_DATA.md`, `SCOPE_FIELD_AUDIT.md` (same directory).

---

## 1. Executive summary

Organization is the **root tenant boundary** of StudioHub. ~44% of backend files (739/1683) and ~39% of frontend files (284/733) reference it.

- **Enforcement posture is fail-closed and layered:** authN (JWT/API key/PAT) never binds a request to an org; authZ does — via `X-Organization-Id` header → `resolve_organization_context` → membership check → `scope_by_request` queryset filtering → per-org grant checks (`HasPermission`, missing map entry = deny). No flat/org/production viewset was found returning unfiltered `Model.objects.all()`.
- **Single-tenant removal is feasible but very large:** every production entity carries a redundant direct `organization` FK alongside its `project` FK; all workspace tabs, query keys, and RBAC grants are org-keyed; RBAC, audit, settings, billing, notifications, and search are org-partitioned. The "fresh DB + reset auth" decision eliminates data migration, leaving a pure code-deletion/restructure task.
- **5 concrete risks found, none currently exploited:** (1) API keys are effectively user-scoped despite an org FK (header swap works when the user belongs to both orgs); (2) `APIKeyService.verify` ignores `expires_at`; (3) the generic API response cache omits org from its key (latent — no active call sites); (4) `User.organizations` includes soft-deleted memberships, feeding 3 selectors; (5) audit/settings selectors scope to *all* member orgs, not the active header org.
- **Could not verify:** runtime Celery-beat behavior, production data volumes for N+1 impact, whether `expires_at` is enforced anywhere downstream of `verify`, and actual multi-org penetration (no live second-org attack test performed).

---

## 2. Complete organization dependency inventory

### 2.1 Backend models (`studiohub/backend`)

Base classes (`apps/core/models/bases/`, `apps/organization/models/base.py`, `apps/production/models/base.py`, `apps/masterdata/models/base.py`):

| Base class | File | Organization content |
|---|---|---|
| `OrganizationOwnedModel` | `apps/core/models/bases/ownership.py:14` | Abstract marker only — each model declares its own `organization` FK |
| `OrganizationScopedModel` (+ `Project/Sequence/Shot/Task/Review/UserScopedModel`) | `apps/core/models/bases/scopes.py:43-124` | Field-less markers, no columns |
| `OrganizationEntityModel` (org app) | `apps/organization/models/base.py:10` | Concrete: non-null `organization` FK (CASCADE) + `code/name/description` |
| `ProductionEntityModel` | `apps/production/models/base.py:10` | Concrete non-null `organization` FK (CASCADE); only `Project` uses it — all other production models declare their own duplicate org FK |
| `CatalogModel` | `apps/masterdata/models/base.py:21` | Nullable `organization` FK — NULL = global row, set = org-custom row |
| `OrgConfigModel` | `apps/masterdata/models/base.py:78` | Non-null `organization` FK + `enabled` flag (per-org overrides) |
| `EntityModel` (all) | `apps/core/models/bases/entity.py:14` | `is_deleted` soft-delete; default `objects` manager hides deleted rows. **No org filtering in any default manager** — `active()` means "not deleted", not "in this org" |

**Organization app entities** (`apps/organization/models/`): `Organization` (root, no self-FK), `Department`, `Team`, `Office`, `Branding`, `Calendar`, `CalendarEvent`, `Holiday`, `WorkCalendar`, `WorkHours`, `OrganizationSettings` (all direct non-null org FK via base); `Client`, `ClientContact`, `ClientContract`, `Vendor`, `VendorContact`, `VendorContract` (direct non-null + parent FK = redundant dual link); `OrganizationBilling` (direct **OneToOne**); `APIKey`, `Invitation`, `OrganizationMembership` (direct non-null); `Person`, `Position`, `Group`, `Role` (direct **nullable** — NULL = global/legacy rows); `UserSession` (nullable, **SET_NULL** — survives org deletion as orphan); `UserPreference` (only `default_organization`, SET_NULL, no reverse accessor); `GroupMember`, `GroupRole`, `UserRole`, `RolePermission` (no org FK — inherit via group/role); `Permission` (fully global catalog); `PersonalAccessToken` (**no org FK at all** — user-scoped only).

**Production entities** (`apps/production/models/`): `Project` (direct org FK) plus `Show`, `Episode`, `Sequence`, `Shot`, `Asset`, `Task`, `Timelog`, `Version`, `Review`, `Media`, `Playlist`, `Workflow`, `ProjectNote`, `ProjectMembership`, `EditorialCut`, `EditorialTrack`, `AutomationRule`, `AutomationAuditLog` — **every one carries its own direct non-null org FK AND a `project` FK** (redundant dual link, §4).

**Identity** (`apps/identity/models/`): zero org FKs on any model. Membership exists only via `OrganizationMembership` join; `User.organizations` is a Python property (`user.py:82-86`) — and it **does not exclude soft-deleted memberships**.

**Cross-cutting apps:** `scheduling` (`CalendarEvent`, `Resource`, `Holiday` direct; `ResourceSchedule`, `ResourceLeave` inherit via `Resource`); `deliveries` (`DeliveryPackage`, `DeliveryDestination` direct; `DeliveryVersionRef` inherits); `audit` (`Activity`, `APIRequest`, `AuditLog`, `BackgroundJob`, `ChangeLog`, `ErrorLog`, `Track` direct; `LoginHistory` nullable SET_NULL); `settings` (`OrganizationSetting` direct; `FeatureFlag`, `Theme`, `Localization` nullable = global-or-org; `SettingCategory/SettingDefinition/SystemSetting` global); `platform` (`StudioNotification`, `ProductionReport` direct); `publishing` (`PublishItem`, `PublishValidationRule`, `PublishDestination` direct); `intelligence` (`KnowledgeDocument`, `SavedSearch`, `RecentSearch` direct); `masterdata` (nullable catalog rows + non-null config rows; `PlatformRole/Group/Department/Position` global); `core` (`Tag`, `Attachment` global).

### 2.2 Backend enforcement chain

1. **Context:** `OrganizationMiddleware` (`apps/core/middleware/organization.py:8`) copies the raw header; `resolve_organization_context` (`apps/organization/middleware/organization_context.py:26`) resolves it post-auth to an org instance + membership (malformed → `None`, fail-closed). Nested routes prefer the URL `organization_id`; unknown org or non-member → `404` (org undiscoverable).
2. **AuthN is org-agnostic:** JWT carries no org binding; API-key and PAT auth verify the secret only, never the org (`apps/identity/authentication/api_key.py`, `personal_access_token.py`).
3. **AuthZ is org-bound and fail-closed:** `HasPermission` denies on missing `permission_map` entry; empty tuple = open; superuser = bypass (logged); otherwise **all** grants checked against `request.organization` (`apps/identity/permissions/permission.py:9-67`). `has_object_permission` denies org-mismatched objects (`:69-96`) — but only for models that *have* `.organization`.
4. **Queryset scoping:** `OrganizationEntityViewSet` / `OrganizationScopedViewSet` / `ProductionEntityViewSet` resolve context post-auth and filter via `scope_by_request` (org `None` → `.none()`); production adds a second project-membership narrowing (`apps/production/api/viewsets/base.py:63-86`). **Services do NOT re-validate** — `BusinessService` CRUD/query helpers take no org (`apps/core/services/business.py`); any shell/task/signal caller bypasses isolation.
5. **Grant resolution** (`apps/identity/resolvers/permission.py`, `apps/identity/services/permission_cache.py`): only active, non-deleted memberships/roles/grants confer rights, in that org only; global (org-NULL) roles apply everywhere; cache keys are org-partitioned (`identity.permission:{user}:{org|global}:{version}`).

### 2.3 Frontend dependencies (`studiohub-react`)

- **Selection & transport:** `OrganizationProvider` (`src/core/organization/OrganizationContext.tsx`), header `OrganizationSwitcher` (`src/layouts/OrganizationSwitcher.tsx`), active org in `localStorage studiohub_active_org_id` → `X-Organization-Id` header on every request (`src/api/client/ApiClient.ts:39-42`). Org switch wipes the entire TanStack Query cache (anti-leakage) and resets the active project. Session boundaries purge tenant keys (`AuthProvider.tsx`, tested by `purgeTenantState.test.ts`).
- **Routes:** `OrganizationRoute` gates every studio route on membership; all entity CRUD routes (`/departments`, `/teams`, `/people`, `/clients`, `/vendors`, …) redirect into `/organizations/:id?tab=`; production routes nest under `/organizations/:organizationId/projects/:projectId` behind `ProjectRoute`. Global (non-org) routes: `/login`, `/organizations/new`, `/platform/admin*`, `/platform/master-data*`, `/platform/health`.
- **Data layer:** every org hook follows `activeOrgId = orgId || currentOrganization?.id`, `enabled: !!activeOrgId`, creates stamp `organization_id`, keys are `['organizations', orgId, resource, …]` (`useClientData`, `useVendorData`, `usePeopleData`, `useOrgStructureData`, `useWorkforceData`, `useAccessData`, `useOrgInsightsData`). Creates/updates/deletes choose nested `/api/organizations/<org>/…` vs flat `/api/v1/…` by org presence — **flat fallback is silent**, so a missing `enabled` gate risks cross-tenant reads.
- **UI:** all workspace tabs receive `org={org}`; selector dropdowns (`DepartmentSelect`, `ClientSelect`, `ProductionRoleSelect`, …) take optional `orgId`; `OrgSavedViewsBar` stores views per org; dashboard/production hooks require org + project.
- **Must stay global:** identity/session, org directory itself (`['organizations','list']`), platform admin + global master data (`['platform',…]` keys), health, login/error pages, theme/notification stores.

---

## 3. Entity relationship and dependency diagrams

```
                        ┌──────────────┐
                        │ Organization │  (root tenant, no self FK)
                        │  status:     │
                        │  active/archived (no cascade)
                        └──────┬───────┘
        CASCADE (hard delete fans out to ALL of these)
               ┌───────────────┼────────────────┐
               │               │                │
     ┌─────────┴────┐  ┌──────┴───────┐  ┌──────┴────────┐
     │ Org entities │  │  Production  │  │ Cross-cutting │
     │ Dept/Team/   │  │  Project     │  │ Audit rows    │
     │ Office/Person│  │  + 18 models │  │ Settings rows │
     │ Client/Vendor│  │  each: org   │  │ Notifs/Reports│
     │ (+contacts/  │  │  FK + proj   │  │ Publish/Deliver│
     │ contracts)   │  │  FK (dual)   │  │ Schedule/Search│
     │ Membership/  │  └──────────────┘  │ Billing (1:1) │
     │ Invitation/  │          │         │ APIKey        │
     │ APIKey/Cal/  │  project FK ──────┘  └──────────────┘
     │ Holiday/Brand│  (denormalized, must agree)
     └──────────────┘
        │ SET_NULL survivors: UserSession, UserPreference.default_organization,
        │   LoginHistory, Org.headquarters_office/primary_supervisor (reverse)
        │ PROTECT blockers (block Role/Dept delete, NOT org delete):
        │   Membership.role, Invitation.role, Team.department
        ╳ NO LINK: Permission (global), PersonalAccessToken (user-only),
        ╳   identity.* (join only), Platform* master rows, Tag
```

Request enforcement flow:

```
Client header X-Organization-Id
  → OrganizationMiddleware (raw copy)
  → resolve_organization_context (post-auth: org instance + membership; bad → None)
  → OrganizationContextMixin / viewset base (nested URL wins; non-member → 404)
  → HasPermission (map lookup; None → DENY; grants checked in request org)
  → scope_by_request (org None → .none(); non-member → .none())
  → [production] scope_by_project_membership (org membership alone ⇒ no rows)
  → has_object_permission (org mismatch ⇒ DENY, models with .organization only)
```

---

## 4. Direct versus indirect dependency matrix

**Domain levels:** G = Global, O = Organization-direct, P = Project/production (org via project), I = Inherited (via parent, no own FK).

| Entity / component | Level | Direct org link | Indirect path | Enforcement | Risk / gap |
|---|---|---|---|---|---|
| Organization | — (root) | — | — | Membership-gated queryset | Delete cascades destructively (§5) |
| Department/Team/Office/Branding/Calendar/CalendarEvent/Holiday/WorkCalendar/WorkHours/OrgSettings | O | Non-null FK, CASCADE | — | `OrganizationEntityViewSet` + `scope_by_request` | None structural |
| Client/Vendor (+Contacts/Contracts) | O | Non-null FK, CASCADE **+ parent FK** | — | Same | Redundant dual link — skew if writers disagree |
| Person/Position/Group/Role | O (nullable) | Nullable FK, CASCADE | — | Same; readers must exclude NULLs | NULL rows are global-ish; fail-closed readers required |
| Membership/Invitation/APIKey/Billing | O | Non-null FK, CASCADE | — | Same | APIKey org FK unenforced at auth (§6.1) |
| UserSession / LoginHistory | O (nullable) | Nullable, **SET_NULL** | — | Session agnostic | Survive org deletion as orphans |
| GroupMember/GroupRole/UserRole/RolePermission | I | None | Via group/role | FK-less fallback (`group__organization`/`role__organization`) else `.none()` | Dangling if parent org-NULL |
| Permission / Platform* / SettingDefinition / Tag | G | None | — | Open reads (`()`) / platform gates | Correct — must not be scoped |
| PersonalAccessToken | G(user) | **None** | — | Listed by user only, any org header | User-global credential; metadata visible under any org |
| identity.User and all identity models | G | None | Membership join only | `UserSelector` (self/co-members) | Correct — session precedes tenancy |
| Project | O | Non-null FK, CASCADE | — | `ProductionEntityViewSet` + project membership | None structural |
| Show/Episode/Sequence/Shot/Asset/Task/Version/Review/… (18 models) | P | Non-null FK, CASCADE **+ project FK** | Chain to Project | Same, dual-narrowed | Redundant dual link — org/project skew possible |
| Audit rows / Settings rows / Notifications / Reports / Publish / Deliveries / Scheduling / Intelligence | O | Non-null FK, CASCADE (LoginHistory SET_NULL) | — | Scoped selectors; **audit/settings scope to ALL member orgs, not active org** | Broader-than-header visibility (§6.4) |
| Masterdata catalog rows | G/O | Nullable FK | NULL = global | Global-only queryset for catalog reads | Correct dual-mode design |
| Frontend: workspace tabs, hooks, query keys `['organizations', org, …]` | O | `organization_id` stamped on writes; header on reads | — | `enabled: !!activeOrgId`; switch wipes cache | Silent flat-endpoint fallback if gate omitted |
| Frontend: org directory, platform admin, auth, health | G | None | — | `requiresOrgMembership: false` | Correct — must stay global |
| Celery tasks / signals / `BusinessService` direct use | — | None passed | — | **None** | Any org-table access bypasses isolation (§6.3) |
| `APIResponseCache` | — | **Not in key** | — | N/A (no active call sites found) | Enabling as-is leaks across orgs (§6.2) |

---

## 5. Organization lifecycle impact analysis

- **Hard delete** cascades at the DB level to every non-null direct org FK: all org entities, clients/vendors + sub-records, billing, keys, invitations, memberships, all production data, deliveries/publishing/scheduling rows, audit rows (except login history), settings rows, intelligence rows, masterdata custom/config rows, notifications/reports. **One `Organization.delete()` destroys projects, assets, audit logs, and billing.** `SET_NULL` survivors (`UserSession`, `UserPreference.default_organization`, `LoginHistory`) become orphans. `PROTECT` on `Membership.role`/`Invitation.role`/`Team.department` blocks role/department deletion but **not** org deletion.
- **Soft-delete is the default** (`EntityModel.delete()` flags `is_deleted`; default managers hide them). No cascade-soft-delete service was found — soft-deleting an org does **not** soft-delete its children at the model layer.
- **Archive/deactivate** (`status` via `LifecycleModel`) has **no model-level cascade** — archiving an org does not auto-archive projects, memberships, or keys. Must be service/view logic; none verified in model files.
- **Transfer** (moving entities between orgs): no transfer service found; redundant dual FKs (org + project/parent) would need synchronized rewrites.
- **Frontend lifecycle:** org switch clears the entire query cache and resets the project; stale `localStorage` org auto-corrects to the first accessible org; logout/expiry purges tenant keys (tested).

---

## 6. Authorization and cross-organization data-leakage risks

1. **Tokens are user-scoped, not org-scoped (Medium).** Neither auth scheme binds the secret to an org — the request org comes solely from the client-supplied header. An API key created in org A used with `X-Organization: org-B` authenticates as its creator; access to B follows iff the *user* belongs to B. The `APIKey.organization` FK only scopes management listing. PATs have no org FK at all. Contained only by membership + per-org grant checks. Files: `apps/identity/authentication/api_key.py`, `apps/identity/authentication/personal_access_token.py`, `apps/organization/services/api_key.py:26`, `apps/organization/models/personal_access_token.py:12`.
2. **`APIKeyService.verify` ignores `expires_at` (Medium).** Expired keys still authenticate (PATs do check expiry). Files: `apps/organization/services/api_key.py:26-37` vs `apps/identity/authentication/personal_access_token.py:30-31`.
3. **Response cache key omits org (Medium, latent).** `APIResponseCache.generate_cache_key` hashes path + 4 query params + user only (`apps/core/cache/api_response.py:45-77`); same user + same path + different org header ⇒ identical key. No active call sites found, and `invalidate_pattern` is a no-op stub — must include the org header before any adoption.
4. **All-orgs selectors exceed the header contract (Low-Medium).** Audit (`apps/audit/selectors/base.py:42-66`) and settings (`apps/settings/selectors/base.py:37-71`) selectors filter to *all* `user.organizations` rather than `request.organization`; `TrackViewSet` reads are open to any authenticated user. A two-org member sees both orgs' audit/settings regardless of active org.
5. **`User.organizations` includes soft-deleted memberships (Low).** `apps/identity/models/user.py:82-90` lacks `is_deleted=False`, unlike `resolve_organization_context`, `OrganizationBaseSelector`, and `PermissionResolver`. Feeds `APIKeySelector`, `AuditBaseSelector`, `SettingsBaseSelector` — removed members may retain visibility those selectors grant.
6. **Off-request paths bypass isolation (Low, structural).** `BusinessService` applies no scope; Celery tasks/signals carry no org; `core/signals/base.py` cache keys contain no org id. Any future task/signal touching org tables leaks unless it filters explicitly.
7. **Frontend flat-endpoint fallback (Low).** `organizationApi.ts` silently uses `/api/v1/…` when `orgId` is falsy; only `enabled` gates + header prevent cross-tenant reads. One omitted gate = exposure.

---

## 7. Missing, inconsistent, redundant, or incorrectly scoped relationships

- **Redundant:** all 18 production children (org FK + project FK), client/vendor contacts + contracts (org FK + parent FK), `Timelog` (org + project + task), `Version` (org + project + nullable parents), `ProjectMembership` (org + project + show). Justification for keeping: single-filter org queries + DB cascade; cost: writers must keep both in agreement (no verified cross-check).
- **Inconsistent nullability:** `Position` overrides the base non-null org FK with nullable (global-master rows) — intentional via `scope` field but weakens the base contract; `Person/Group/Role` nullable likewise; readers must treat NULL as non-member-visible.
- **Missing:** PAT org link (by design, user-global — but then management listing should be explicit about it); org archive/deactivate cascade; transfer tooling; expiry enforcement on API keys at the auth gate.
- **Incorrectly broad:** audit/settings all-orgs selectors (see §6.4); `PlatformOverviewViewSet.overview` returns global overview with no scoping (verify intentional); `BillingView` falls back to `Organization.objects.first()` for superusers.

---

## 8. Recommended changes (prioritized)

**Critical** — none currently exploitable end-to-end (membership + grant gates hold). If a second-org penetration test proves otherwise, re-grade §6.1/§6.2 to Critical.

**High**
- H1. Bind API keys to org at verify time (key org must equal request org) **or** formally document user-scoped semantics and remove the misleading `organization` FK from the trust story.
- H2. Enforce `expires_at` in `APIKeyService.verify` (parity with PATs).

**Medium**
- M1. Include `X-Organization-Id` (and full filter params) in `APIResponseCache` keys + implement `invalidate_pattern` before enabling on any org endpoint.
- M2. Add `memberships__is_deleted=False` to `User.organizations` (align with every other gate).
- M3. Narrow audit/settings selectors to the active `request.organization` (or document the all-orgs auditor-UX exception).
- M4. Add a write-time consistency check that dual-FK rows agree (e.g. `Shot.organization == Shot.project.organization`), or a periodic audit command.

**Low**
- L1. Pass explicit `organization` into any future Celery task/signal touching org tables; add org id to `core/signals` cache keys if wired to scoped models.
- L2. Make frontend flat-endpoint fallback loud (warn/throw when `orgId` missing on org-entity calls) instead of silent.
- L3. Document PAT user-global semantics in the API-keys/PAT UI (token metadata currently listed under any org header).
- L4. Define org archive/deactivate cascade + transfer procedure before they are needed operationally.

---

## 9. Proposed implementation plan (not executed)

1. **Confirm scope decision** (single-tenant removal vs harden-multi-tenant) — this audit serves both: removal deletes §2–§4 surface; hardening implements §8.
2. **H1 + H2 first** (token binding, key expiry): backend-only, TDD with second-org header-swap tests; no migration needed (query change + verify check).
3. **M2 + M3** (membership consistency, selector narrowing): small queryset changes + regression run of org/audit/settings suites.
4. **M1** (cache key): gate behind a test proving cross-org key collision, then fix.
5. **M4 + L1–L4**: validators/docs/UI copy; no schema changes except possibly transfer tooling.
6. **If single-tenant removal proceeds:** delete in dependency order — frontend org plumbing (switcher, guards, `orgId` params, key prefixes) → backend viewset mixins/selectors → services validators → models + squashed fresh migrations (no data migration per the fresh-start decision) → rewrite affected tests. Verified throughout with full suites + UI-only Playwright checks per repo rules.
7. **Re-audit** with a live second-org penetration pass (header swap, stale membership, expired key, cached response) before release.

---

## Appendix: verification notes

**Remediation status (Phase 1, 2026-10-14):** H1 (key→org binding at auth), H2
(key expiry in `verify`), M2 (`User.organizations` excludes deleted
memberships), M3 (audit/settings selectors prefer the active org when the
caller belongs to it, with member-org fallback + post-auth context resolution
in both base viewsets), and the M1 cache-key partition are **fixed and
tested**. The audit/settings narrowing additionally verifies that a foreign
header grants nothing (membership-checked). Remaining open: M4 dual-FK
agreement checks, L1–L4, and the 3 pre-existing `apps/core` test failures
(openapi schema, bare-array envelopes, admin registry — all reproduce on
pristine `develop`).

- Spot-verified by direct file reads: cache key composition (`apps/core/cache/api_response.py:45-77`), `APIKeyService.verify` (`apps/organization/services/api_key.py:26-37`), `User.organizations` (`apps/identity/models/user.py:80-92`), PAT model fields (`apps/organization/models/personal_access_token.py:12-24`).
- Assumed (not verified): no hidden `Model.objects.all()` exposure in unexamined custom actions; Celery-beat schedules; production runtime data shapes; downstream `expires_at` enforcement outside `verify`.
- Not verified: live exploitation of any listed risk; performance impact of annotation-less per-row queries at scale; frontend bundle behavior after hypothetical org-layer removal.
