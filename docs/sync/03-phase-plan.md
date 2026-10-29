# 03 — Phase plan (proposed — awaiting approval)

Each phase runs on its own branch `sync/phase-N-<name>`, cut from the previous phase's approved tip; small commits; dead-code removal in separate commits; ends with a report and a stop. Every phase's part C produces `docs/sync/phase-N-verification.md` and must pass `pnpm typecheck`, `pnpm test`, `pnpm build`, and introduce **no new** Biome errors (baseline: 2 errors, 4,142 warnings).

## Dependency graph (from the model FKs and permission checks)

```
identity.User ──────────────┬──────────────┬─────────────┬──────────────┐
  (actor, assignee, owner)  │              │             │              │
masterdata (Department, Team, Person, Client, Vendor, catalog types/statuses)
  │                         │              │             │
production.Project ─ Show ─ Episode ─ Sequence ─ Shot ⇄ Asset
  │                                         │       │
  │                                       Task ─ Timelog
  │                                         │
  │                                      Version ─ Review / Playlist / Media
  │                                         │
  ├── deliveries (DeliveryPackage → Client, Version)
  ├── publishing (PublishItem → Version, StorageRoot)
  └── scheduling (Resource → Person/Department; ResourceSchedule/Milestone → Project)
audit (ChangeLog/AuditLog/Activity → actor; target as string) — readable as soon as anything writes
settings (independent; gates feature flags across the UI)
dashboards/analytics (read everything)
```

Ordering follows your default heuristic. One deviation: identity *administration* (users, sessions, MFA, credentials) is split out of the foundation into Phase 2, because Phase 1 is already the largest phase and the admin screens are not needed for the foundation's exit criteria.

## Phase 1 — Frontend foundation · branch `sync/phase-1-foundation` · size **XL**

**Why first:** every later phase reuses the client, errors, pagination, permission and form layers; the current ones are wrong in ways that would be copied into every module (gap §1).

**In scope**
- API client: keep `ky`; single URL builder (per-route trailing-slash rule, incl. the slash-less `platform/master-data/*`); auth header; 401 → refresh → retry once; **cross-tab single-flight refresh** (`navigator.locks` with BroadcastChannel fallback; pick up rotated tokens from other tabs); reject queued requests on refresh failure, then logout; `AbortSignal` passthrough; logout sends `{refresh}`.
- Auth: MFA challenge step (`mfa_required` → `POST /auth/mfa/challenge/`, with `remember_device`), `mfa_enrollment_required` routing, reset-password page, `must_change_password` (keep), profile PATCH limited to Profile fields. Token storage per Q6: access token in memory only, refresh token in `localStorage`.
- Errors: one `normalizeApiError` → `{status, message, fieldErrors, nonFieldErrors, code, requestId, retryAfter}` covering flat DRF bodies, nested serializer errors, SimpleJWT `code/messages`, `error.{code,request_id}`, 401/403/404/405/409(`has_dependants`)/413/423/429/5xx/network/timeout. Tests built from [samples/](samples/).
- Types: regenerate `openapi.ts` from the live schema (`pnpm api:generate` with a committed fresh snapshot); `src/api/<app>/` type modules; hand-written types for the 19 un-schema'd views (CR-08) validated against samples; drop or regenerate `ContractValidator`.
- Data layer: query-key factory per resource; `usePaginatedList` (page/page_size/search/ordering/filters → `{count,next,previous,results}`) and `useFullList` (bare-array endpoints); mutation helpers with invalidation; optimistic updates off by default.
- Forms: `useServerForm` mapping `fieldErrors` onto react-hook-form fields and `nonFieldErrors` into a banner; field config helpers from OpenAPI (required, maxLength, enum, readOnly, nullable).
- Permissions: `useCan(code | code[], {projectId?})` = `is_superuser` ∨ code ∈ `user.permissions` (∧ membership for project-scoped checks); `<Can>`/route guards on top; a **mapping table** from the 290 invented codes to backend codes (or to "no backend equivalent → remove the gate"); 403 → "no permission" state, 404 on project-scoped views → "not found / no access".
- UX primitives: loading/empty/error/retry states, toasts with request id, confirm dialog for destructive actions (shows 409 dependants), upload with progress (`/core/attachments/`, multipart, 413/429 handling).
- Export: shared `exportAll(listEndpoint, queryParams)` → CSV for all rows matching the current filters (Q4), with progress, cancel and a 10k-row warning; wired into the shared table toolbar.
- Removals (separate commits, listed in the report): Reports, Notifications and Data Platform pages + routes + nav + `/reports/` call (Q2), `core/testing/**` + `/testing` route, demo users, stale health probe list (fix `DJANGO_HEALTH_PATH` default to `/health/`), `features/organizations/`, client-side activity recording on login/logout, the client role matrix and unbacked permission engines once the mapping is in place, frontend `CLAUDE.md` mock sections.

**Endpoints in scope:** `/auth/{login,refresh,logout,me,change-password,forgot-password,reset-password,mfa/challenge}/`, `/info/version/`, `/health/`, `/departments/` (sample list/create flow), `/core/attachments/` (upload primitive).

**Risks:** the permission re-keying touches many screens (mechanical but wide); cross-tab refresh needs careful tests; regenerated types will surface many type errors in modules — Phase 1 fixes compile errors only at the foundation boundary and leaves module-level type fixes to their phases (with `// TODO(sync-phase-N)` markers and a list in the report).

**Exit criteria:** login (with and without MFA), refresh (incl. two tabs racing), logout and session-expiry all work against a running backend; departments list (paginated, search, ordering) + create (with server field errors shown inline) work end to end; normaliser and refresh tests green; typecheck/test/build green.

## Phase 2 — Identity & access administration · `sync/phase-2-identity` · size **L**

**Why here:** users/roles/permissions are referenced by every other module (assignees, owners, reviewers), and the RBAC screens let an admin grant the codes the later phases gate on.

**Scope:** user administration **inside People** (Q1): Account section on the person page — linked user's lifecycle (`/identity/users/{id}/` activate/deactivate/suspend/unsuspend/archive/restore/reset-password/force-password-change/revoke-sessions, role assignment) or "Create login" (`POST /identity/users/` + `POST /people/{id}/link-user/`); the People list/CRUD itself stays in Phase 3; roles with `permissions`/`users`/`groups` sub-resources (grant with `expires_at`); groups with `members`/`roles`; permission catalog browser; My account under `/settings/account/*` (Q3): profile, password, sessions (current, revoke, revoke-all-other), MFA enroll/verify/disable/recovery codes/trusted devices (canonical `/identity/auth/mfa/*` tree only), personal access tokens and API keys (secret shown once, rotate, revoke); admin ledgers (security events, login history, login attempts, IP blacklist) — superuser-only until CR-02.

**Risks:** CR-02 (unseeded codes) limits non-superuser admins; the create-login flow is two non-atomic calls (retry-link path needed).
**Exit:** an admin can create a user, assign a role, and that user's next `/auth/me/` shows the new permissions and the UI reacts; MFA enroll→login-with-challenge round trip works.

## Phase 3 — Masterdata (directory + catalog) · `sync/phase-3-masterdata` · size **M**

**Why here:** production, deliveries and scheduling forms need department/team/person/client/vendor pickers and catalog enums (statuses, task/asset/shot types).

**Scope:** departments, teams, offices, positions, people (+ deactivate/reactivate/restore/link-user/unlink-user; drop `set-password`), clients, vendors, contacts, contracts (+ activate/terminate/adjust-end-date), catalog types/statuses/software(+versions) incl. archive/restore/**reorder**; reusable async FK pickers (search + pagination) for all of them; sensitive-field visibility via `masterdata.client.view_financial` / `masterdata.person.view_sensitive`; 409 `has_dependants` UX.
**Risks:** Q-01 (contacts 403); CR-01 headers (ignored).
**Exit:** every directory/catalog screen paginates, filters and orders with the backend's param names; pickers reused by Phase 5+.

## Phase 4 — Audit & activity viewer · `sync/phase-4-audit` · size **M**

**Why here (early):** later phases verify their writes through it, and it delivers the shared **History panel** every detail page will embed.

**Scope:** audit logs (`/audit/` + `/audit/audit-logs/`), change logs (diff viewer: `before_values` → `after_values`), activity feed (`/activity/`), API requests, background jobs (cancel/retry), error logs (resolve), tracks; login history path fix; `<EntityHistory targetType targetId />` combining ChangeLog (`target_type`+`target_id`), `status-history/` where available, and AuditLog once CR-03 lands; remove the client-side audit/activity shims.
**Risks:** CR-03, CR-04.
**Exit:** editing a department (Phase 3) shows a ChangeLog row with actor and field diff in its History panel.

## Phase 5 — Production A: projects & structure · `sync/phase-5-production-structure` · size **L**

**Scope:** projects (+ archive/restore/archived, statistics, dashboard), project members (`POST members/`), project workspace tabs wired to the project-scoped views (overview/summary, members, notes, activity, pipeline, resources, files, schedule) instead of empty fallbacks; shows; episodes; sequences (bulk ops, check-existence); editorial tracks.
**Depends on:** 2 (users), 3 (clients, statuses), 4 (history panel).
**Exit:** a project can be created, staffed, structured (show → episode → sequence) and every workspace tab shows backend data or a real empty state.

## Phase 6 — Production B: shots, assets, tasks, time · `sync/phase-6-production-work` · size **XL**

**Scope:** shots (+ approve, rename-code, status-history, asset links, bulk), assets (+ rename-code, shots, bulk), tasks (+ bulk create/update/archive/restore/assign/status/delete, status-history, all filters), timelogs (+ approve/reject, status-history), task templates (+ apply, copy-to-project); project tabs for tasks/timelogs.
**Exit:** artist and lead flows (pick task → log time → lead approves) work with role-correct UI.

## Phase 7 — Production C: versions, reviews, playlists, media, workflows · `sync/phase-7-production-review` · size **L**

**Scope:** versions (+ publish/unpublish/promote/add-to-playlist/status-history), reviews (full state machine, comments/notes/annotations, participants add/remove, verdicts, versions), playlists (entries, reorder, share), media, workflows (+ activate/deactivate/clone/simulate), automations rules/logs; project tabs for versions/reviews/playlists/media/workflow.
**Exit:** version → review → approve round trip; playlist built and shared.

## Phase 8 — Deliveries · `sync/phase-8-deliveries` · size **M**

**Scope:** deliveries full lifecycle (validate, prepare, submit, approve/reject, sign-off, revise, reopen, cancel, complete, retry, add/remove version, bulk-cancel), history and QC tabs, passcode reveal (`delivery.view_secret`), destinations; project Deliveries tab. **Depends on:** versions (7), clients (3).

## Phase 9 — Publishing · `sync/phase-9-publishing` · size **M**

**Scope:** publishes (+ validate/retry/republish/unpublish, and `start-export`/`complete-export`/`fail` exposed in the UI per Q5), published files (+ bulk-register/deprecate/revoke/restore), destinations, storage roots; project Publishing tab. **Depends on:** versions (7).

## Phase 10 — Scheduling · `sync/phase-10-scheduling` · size **L**

**Scope:** resources (+ book/block), bookings grid (`schedules` + bulk-delete), leaves (+ approve/reject), holidays, work calendars (+ set-default), milestones (+ complete/reopen), events (+ update-status), capacity/overbooking/resolve; rates visibility (`schedule.view_rates`); project Schedule/Calendar/Resources tabs. **Depends on:** people/departments (3), projects (5).

## Phase 11 — Settings & platform admin · `sync/phase-11-settings` · size **M**

**Scope:** under `/settings/system/*` (Q3): system settings (+ lock/unlock), feature flags (+ enable/disable/schedule) and a `useFeatureFlag` hook, themes (+ activate), localizations (+ activate), setting categories/definitions; tags; remove the mock DB schema/export section. **Risk:** CR-02 (`settings.view`).

## Phase 12 — Dashboards & analytics · `sync/phase-12-dashboards` · size **M**

**Scope:** home dashboard and project dashboard on `/projects/{id}/dashboard/`, `/statistics/`, project-scoped `summary/`; `/analytics/{kpis,departments}`; remove remaining client-side metric fabrication. **Depends on:** everything above.

## Final phase — Cross-cutting hardening · `sync/phase-13-hardening` · size **L**

E2E smoke per role (superuser, production admin, supervisor, lead, artist, no-role) with Playwright against a seeded backend (needs CR-05 or a factory-based seed); consistency pass (one data-access style, shared components, duplicate calls); performance (pagination everywhere, debounced search, lazy routes, no waterfalls); security (token handling, XSS-safe rendering, no secrets in bundle, no tokens in logs); accessibility and responsive checks; final `docs/sync/README.md`.

## Summary

| Phase | Name | Size | Key dependency | Blocking CRs |
|---|---|---|---|---|
| 1 | Foundation | XL | — | — |
| 2 | Identity & access admin | L | 1 | CR-02 (non-superuser admins) |
| 3 | Masterdata | M | 1 | — (Q-01) |
| 4 | Audit & activity | M | 1, 3 | CR-03, CR-04 (partial) |
| 5 | Production A | L | 2, 3, 4 | — |
| 6 | Production B | XL | 5 | — |
| 7 | Production C | L | 6 | — |
| 8 | Deliveries | M | 3, 7 | — |
| 9 | Publishing | M | 7 | — |
| 10 | Scheduling | L | 3, 5 | — |
| 11 | Settings | M | 1 | CR-02 |
| 12 | Dashboards | M | 5–10 | — |
| 13 | Hardening | L | all | CR-05 (seeded e2e) |

Sizes: M ≈ 1–3 days of focused work, L ≈ 3–5, XL ≈ 5–8 (rough, for relative planning).
