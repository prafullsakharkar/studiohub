# Single-Org Simplification Matrix — StudioHub

**Goal:** maintainable single-organization VFX production platform. Fresh DB, reset auth (no data migration).
**Method:** delete genuinely unused code, reduce duplication; no new abstractions, no destructive rewrite of working modules.
**Phase 1 (this cycle):** security gaps S1–S5. Phase 2+: structural removal (needs per-item approval before deleting UI/routes).

## Phase 1 — Security fixes (implement now)

| ID | Fix | Files | Risk |
|---|---|---|---|
| S1 | Enforce `expires_at` in `APIKeyService.verify` | `backend/apps/organization/services/api_key.py:26` + tests | Low — currently expired keys authenticate |
| S2 | Bind API key to request org at auth time (mismatch → `AuthenticationFailed`) | `backend/apps/identity/authentication/api_key.py` + tests | Medium — header-swap across orgs stops working |
| S3 | Exclude soft-deleted memberships from `User.organizations` | `backend/apps/identity/models/user.py:82` + tests | Low — aligns with every other gate |
| S4 | Audit/settings selectors prefer active `request.organization`, fallback to member orgs; resolve post-auth context in both base viewsets | `backend/apps/audit/selectors/base.py`, `apps/settings/selectors/base.py`, `apps/audit/api/viewsets/base.py`, `apps/settings/api/viewsets/base.py` + tests | Medium — permission evaluation may newly honor per-org grants |
| S5 | Include org header in `APIResponseCache` key (still disabled by default) | `backend/apps/core/cache/api_response.py` + unit test | Low — no active call sites |

## Keep (no change)

Organization model (singleton row), Departments, Teams, Offices, People, Positions, Clients, Vendors (+contacts/contracts), Projects + full production chain (Show→Episode→Sequence→Shot→Asset→Task→Version→Review), master-data catalog + org configs, JWT auth, RBAC grant model (globalized in Phase 2), audit logs, notifications, reports, billing page, PAT/API-key management UX, all workspace tabs and their CRUD.

## Simplify (Phase 2)

| Area | Current | Target |
|---|---|---|
| Org context (frontend) | Switcher + `switchOrganization` + favorites/recents + `studiohub_active_org_id` | Fixed singleton org resolved once; header still sent |
| Org resolution (backend) | Header → membership → per-request org | Same pipeline, single org; `OrganizationContextMixin` 404 paths become unreachable but harmless — remove only after routes flattened |
| Routes | Nested `/api/organizations/<id>/…` + flat `/api/v1/…` dual trees; frontend nested-vs-flat branching | Keep both working; remove flat fallback *silence* (loud error) — do NOT delete a tree until callers migrated |
| Query keys | `['organizations', orgId, …]` segments | Keep (harmless, correctly partitioned); removing churns cache compat for zero benefit |
| Redundant FKs (`Shot.organization` + `Shot.project`, etc.) | Dual links, no cross-check | Keep columns; add write-time agreement validation (audit M4). Dropping columns = destructive rewrite — explicitly out of scope |
| `User.organizations`, permission cache | Per-org partitioning | Keep working during transition; globalize only when membership model itself is removed |

## Remove (Phase 2, confirm each before deleting)

- [x] `OrganizationSwitcher` dropdown → static badge (done)
- [x] Organizations directory + create pages (done; `/organizations` redirects to `/`)
- [x] Workspace "Switch to this Tenant" + denial switch list (done)
- [x] Billing `objects.first()` fallback (done)
- [x] Update-path org reassignment guard + team partial-update wipe fix (done)
- [ ] Invitation accept/decline flows — **REMOVED this cycle**: model, API
  (flat + nested routes), admin, serializers, services, events, permission
  codes, invitee carve-outs + migration `0040`. Frontend invite wording
  reworded to Add (add-person form retained as the onboarding path).
- [ ] Duplicate list-page redirects (`/clients` → `?tab=`) — **kept**: 1-line compat shims, removal breaks bookmarks for zero logic savings
- [ ] `OrganizationRoute` membership gate → stays as the authorization boundary (denial simplified, gate intact)

## Defer (explicitly out of scope)

- Dropping any `organization` DB column or the `Organization` model itself
- Transfer/merge tooling between orgs (no longer needed single-tenant; delete only the code paths, not data)
- PAT user-global semantics change (documented in L3; token format stays)
- Org archive/deactivate cascade design (L4)
- L2 loud flat-fallback — **verified unnecessary**: header-less flat reads scope
  to `.none()` server-side (locked by `test_flat_no_header.py`); hooks gate on
  `enabled` client-side. No warning added (would be noise).
- M4 dual-FK review — create paths stamp org server-side; update paths strip
  payload org (`OrganizationEntityViewSet.perform_update`); parent refs
  (`department_id`, `lead_id`, `manager_id`) validated org-scoped in
  serializers. Columns untouched by design.

## Verification per phase (roadmap checkpoints)

- **Phase 0 baseline** — documented in `ORGANIZATION_DEPENDENCY_AUDIT.md`; matrix above.
- **Phase 1 frontend** — done: switcher removed, static badge, directory/create removed, denial without switching, context pruned. Live: `/organizations` → `/dashboard`, workspace tabs load.
- **Phase 2 backend resolution** — kept as-is: header→membership resolution is the authZ boundary; single-org behavior achieved by frontend always sending the fixed header. No weakening.
- **Phase 3 security** — done (S1–S5 + billing + update guard): key expiry, key-org binding, membership filter, audit/settings scoping, cache partition, update-org strip, flat no-leak lock test.
- **Phase 4 DB/FK review** — done (M4): dual FKs kept + verified (create stamps server-side, update strips, parents org-scoped). No columns dropped.
- **Phase 5 dead code** — done: invitation flow removed (model + routes + permissions + migration 0040), org favorites/recents/unused context removed.
- **Phase 6 E2E** — done: UI-only round-trip (login → 6 entity creates + updates → project + member → shot/asset/task → search → invalid/401). Backend 2289 green; frontend 322 green + vite build green. Bugs found + fixed: task create missing `code`; shot form required-description gate visible. Deferred: `/workspace` project-context "not found" (pre-existing), asset list project_fallback display, 3 pre-existing core-suite failures.

## Migration strategy decision

**Safe migrations — keep data, never reset.** Rationale: real records now exist
(E2E-created entities + Apex org); a migration reset would wipe them and the
production config. Sequential migrations (incl. `0040` invitation removal)
preserve them. Revisit only if a truly disposable scratch environment is ever
spun up.

## Authorization contract (unchanged, fail-closed)

- Missing/foreign org header → `.none()` rows (locked by tests).
- Update payloads can never reassign `organization` (stripped server-side).
- API keys bound to their org + expire.
- Deleted memberships grant nothing.
- Audit/settings follow the active member org.

Frontend verification: `npx tsc --noEmit`, vitest full suite, vite build,
Playwright UI-only checks for user-visible changes. Docs updated in the same
commit.
