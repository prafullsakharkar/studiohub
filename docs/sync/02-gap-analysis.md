# 02 — Gap analysis (Phase 0)

Legend: ✅ **OK** · 🔧 **FIX** · ➕ **ADD** · 🗑️ **REMOVE** (proposed only; nothing deleted yet) · ⚠️ **BACKEND-GAP** (see [backend-change-requests.md](backend-change-requests.md)).

**Depth of this pass.** Route level is complete: every backend route was checked against every frontend URL literal and call site. Field level was spot-checked on 13 core entities (§3); full field-level parity (serializer ⇄ TS type, enums, required/read-only) is part C of each module phase. A ✅ below means "route, method and envelope match"; it does not yet certify every field.

## 0. Summary

| | Count | Notes |
|---|---|---|
| Backend API paths | 486 (+17 project-scoped) | [00-backend-inventory.md](00-backend-inventory.md) |
| Touched by the frontend | 264 | heuristic, method-agnostic |
| Untouched (➕ candidates) | 222 | whole areas: identity admin, settings, task templates, publishing files/storage roots, scheduling calendars/milestones/bookings, archive/restore/archived and status-history actions |
| Frontend URLs with no backend route (🔧/🗑️) | 28 non-test + 52 in the dead test harness | §4 |
| Frontend permission strings not in the backend | 290 of 358 | §1.6 |
| Project workspace tabs with no data source | 14 of 22 | §2.3 |
| Lists that silently truncate at page 1 | ~50 call sites | §1.4 |
| Backend gaps raised | 9 CRs + 1 question | |

## 1. Foundation (cross-cutting) — drives Phase 1

| # | Item | Status | Evidence | Action |
|---|---|---|---|---|
| 1.1 | Base URL from env, same-origin proxy | ✅ | `api/repositories/config.ts`, `server.ts:11` | keep |
| 1.2 | Trailing slashes (APPEND_SLASH) | 🔧 | `BaseRepository` normalises; `platform/master-data/*` routes have **no** trailing slash in the router (`…/asset-types`), others require one | one URL builder that follows the backend's per-route slash rule |
| 1.3 | Auth header injection, 401 → refresh → retry once | ✅ | `ApiClient.ts:31-41,127-151` | keep |
| 1.3a | Refresh single-flight **across tabs** | 🔧 critical | backend revokes the session on refresh reuse ([_auth_flow.json](samples/identity/_auth_flow.json) `refresh_reused_rotated` → 401, then `me_after_logout` 401 `session_expired`); client has a per-tab lock only | BroadcastChannel/`navigator.locks` lock + storage event to pick up the rotated token |
| 1.3b | Queued requests on refresh failure | 🔧 | `ApiClient.ts:118-120` drops subscribers → requests hang | reject queued requests, then logout |
| 1.3c | Logout sends refresh token | 🔧 | `RESTAuthAdapter.logout` posts `{}` | send `{refresh}` |
| 1.3d | MFA login (`mfa_required` → challenge) | ➕ | API-MFA-09; `RESTAuthAdapter.login` ignores it | challenge screen + `POST /auth/mfa/challenge/` |
| 1.3e | `mfa_enrollment_required`, `must_change_password` | 🔧 / ✅ | login body; `passwordChangeGuard.ts` handles the latter | route to MFA enrollment |
| 1.3f | Reset password (token link) | ➕ | `POST /auth/reset-password/` unused | reset page |
| 1.3g | Token storage | 🔧 security | `tokenStorage.ts` keeps access + refresh in `localStorage` | access in memory; refresh in `sessionStorage`/memory with the cross-tab lock (no backend change: httpOnly-cookie refresh would need one — not proposed) |
| 1.4 | Pagination envelope | 🔧 | 46 paginated vs 32 bare-array lists (inventory §4); ~50 `Array.isArray(res)?res:res.results` sites drop `count`/`next` (`api/masterDataApi.ts:154-275`, …); `accessApi` types paginated roles/groups/permissions as arrays; `BaseRepository.findAll` types bare arrays as paginated | typed `listPaginated` vs `listAll` per endpoint; paginated tables everywhere |
| 1.5 | Error normalisation `{status,message,fieldErrors,nonFieldErrors,code,requestId}` | 🔧 | `ApiError.fromDrfResponse` ignores `error.code`/`error.request_id`, SimpleJWT `code`/`messages`, nested serializer errors, `Retry-After`; inventory §3 has the real shapes | rewrite parser against [samples](samples/) |
| 1.6 | Permission layer | 🔧 critical | 290/358 frontend codes don't exist; client-side `ROLE_PERMISSIONS[user.role]` merged into decisions (`rbac.ts:240-290`); superuser handled only for `platform.*` | `useCan(code)` = `is_superuser` ∨ `code ∈ user.permissions`; re-key every gate to backend codes (mapping table built in Phase 1); delete client role matrix and engines the backend doesn't back |
| 1.6a | Project-scoped guards | ✅ | `ProjectRoute` uses `user.project_memberships` (shape matches `frontend_user.py`) | keep; treat 404 from project-scoped views as "no access" |
| 1.7 | Generated types | 🔧 | snapshot 2026-10-19: 56 ops removed since, 126 added; 19 views absent from schema | regenerate from the live schema; hand-type the 19 from samples; drop runtime `ContractValidator` or regenerate it |
| 1.8 | Bulk helpers | 🔧 | shot/asset/task adapters and episode/sequence repositories call the right `bulk-create/update/archive/restore/` routes ✅; but the `BaseRepository` defaults post to `bulk/` (no such route) and `useBulkDelete` posts `/{resource}/bulk-delete/` for every resource (exists only for `tasks`, `scheduling/schedules`) | fix the defaults; disable bulk delete where unsupported |
| 1.9 | Soft delete vs archive | 🔧 | production resources expose `archive/` + `restore/` + `archived/` lists (all unused); masterdata has `restore/`; `DELETE` on referenced rows → 409 `has_dependants` | archive-first UX; show 409 reason |
| 1.10 | Uniqueness pre-checks | ✅ / ➕ | `check-existence/` wired for shots, assets, tasks, episodes, sequences; unused for projects, shows, versions, reviews, playlists, media, workflows, timelogs, editorial tracks | extend where codes are user-entered |
| 1.11 | Health check | 🔧 | `DJANGO_HEALTH_PATH` default `/api/health`; Django serves `/health/`; `apiHealthData.ts` probes 16 non-existent paths | fix default; probe real routes or `/api/v1/info/version/` |
| 1.12 | Deprecation headers | ⚠️ CR-01 | flat directory/RBAC routes flagged deprecated with no successor | ignore in the client |
| 1.13 | Request correlation | ➕ | `X-Request-ID` / `error.request_id` | show request id in error toasts/details |
| 1.14 | Rate limits | 🔧 | 429 `Retry-After` on login/refresh/MFA/password/uploads | back-off + message |
| 1.15 | File upload with progress | 🔧 | `ApiClient.upload` uses ky without progress; uploads go to `/core/attachments/` (multipart, `upload` throttle 60/h) — frontend uses compat `/attachments/` | XHR/ky progress; one attachments client |
| 1.16 | Export | — | no export endpoint exists in the backend (CSV/Excel renderers unused) | client-side CSV only if wanted (question Q4) |

## 2. Per-app matrices

### 2.1 Identity (auth, users, sessions, MFA, credentials, RBAC)

| Resource / feature | Backend | Frontend today | Status |
|---|---|---|---|
| Login / refresh / logout / me / change-password | `/auth/*` | used | ✅ (fixes in §1.3) |
| Forgot password | `/auth/forgot-password/` | `ForgotPasswordPage` | ✅ (verify payload) |
| Reset password, MFA challenge | `/auth/reset-password/`, `/auth/mfa/challenge/` | none | ➕ |
| Profile edit (`PATCH /auth/me/`) | Profile fields only | sends `Partial<User>` | 🔧 send only `first_name,last_name,display_name,avatar_url,phone,bio,timezone,language,preferences` |
| **User administration** `/identity/users/` (CRUD + activate, deactivate, suspend, unsuspend, archive, restore, reset-password, force-password-change, revoke-sessions) | 13 routes, bare-array list | none (People module manages `masterdata.Person`, not users) | ➕ (several actions ⚠️ CR-02: unseeded codes) |
| My sessions `/identity/sessions/` (current, revoke, revoke-all-other, activity) + admin sessions | 8 routes | none | ➕ |
| MFA self-service `/identity/auth/mfa/{enroll,verify,disable,recovery,recovery/verify,devices,devices/revoke}` | canonical tree | none | ➕ |
| Deprecated MFA tree `/identity/mfa/*`, `/identity/{login,logout,refresh}/` | deprecated | unused | ✅ (never adopt) |
| Personal access tokens, API keys (create shows secret once, rotate, revoke) | 6 routes | none | ➕ |
| Trusted devices | owner-scoped list/revoke | none | ➕ (inside MFA settings) |
| Security events, login history, login attempts, IP blacklist | admin ledgers | `LoginHistoryPage` calls `/audit/login-history` | 🔧 path → `/identity/login-history/` (bare array); ➕ the others; ⚠️ CR-02 (view codes unseeded) |
| Roles `/roles/` + `{id}/permissions|users|groups` | paginated; member/grant sub-resources | CRUD used via `accessApi` (typed as arrays) | 🔧 envelope; ➕ grant/assign sub-resources (`POST {permission_id, expires_at?}`, `DELETE {permission_id}`) |
| Groups `/groups/` + `{id}/members|roles` | paginated | CRUD used; members/roles unused | 🔧 envelope; ➕ membership |
| Permissions catalog `/permissions/` | paginated, filter `module,action,category,is_system,is_active` | read used | 🔧 envelope |
| Demo users | none | `useDemoUsers`, `demoUserUtils` | 🗑️ |

### 2.2 Masterdata (directory + catalog)

| Resource | Backend | Frontend | Status |
|---|---|---|---|
| Departments, Teams, Offices, Positions | CRUD + `restore/`, paginated, filters per inventory | CRUD via `masterDataApi` | 🔧 pagination (first page only), permission codes (`department.*` → reads open / `masterdata.directory.manage`), 409 `has_dependants` on delete; ➕ restore |
| People | CRUD + `deactivate`, `reactivate`, `restore`, `link-user`, `unlink-user` | CRUD; `set-password/` (no route) | 🔧 drop `set-password` (passwords belong to identity users; use `link-user` + user admin); ➕ lifecycle + link/unlink; field drift (§3) |
| Clients, Vendors | CRUD + `restore/` | CRUD | 🔧 pagination/permissions; ➕ restore |
| Client/Vendor contacts | CRUD + `restore/` | used | 🔧 (Q-01: 403 for non-directory users) |
| Client/Vendor contracts | CRUD + `activate`, `terminate`, `adjust-end-date`, `restore` | CRUD only | ➕ lifecycle actions |
| Catalog: asset/shot/task/review/file types, statuses, software (+versions) | CRUD + `archive`/`restore`/`reorder`, **bare arrays, no trailing slash** | CRUD + archive/restore via `masterDataApi` | ✅ routes; ➕ `reorder`; 🔧 permission codes `platform.*` → `masterdata.catalog.manage` |
| Platform overview | `/platform/overview` | used | ✅ |
| Field-level sensitive data | `masterdata.client.view_financial`, `masterdata.person.view_sensitive` (service-side masking) | `field.*` engine with invented codes | 🔧 re-key to backend codes |
| "Push mock roles… to backend" | — | `PlatformAdminPage.tsx:392` | 🗑️ |

### 2.3 Production

Route coverage per resource (touched/total): projects 4/9, shows 2/7, episodes 9/11, sequences 9/11, shots 12/16, assets 10/13, tasks 12/15, timelogs 4/10, versions 7/12, reviews 17/25, playlists 8/11, media 2/7, workflows 7/11, editorial tracks 2/7, task-templates 0/4, project-scoped 16/17.

| Feature | Status | Detail |
|---|---|---|
| List/detail/create/update/delete for projects, shows, episodes, sequences, shots, assets, tasks, timelogs, versions, reviews, playlists, media, workflows, editorial tracks | ✅ routes / 🔧 fields | field drift on every entity checked (§3); PUT vs PATCH: backend accepts both, PUT requires all required fields (sample `project_put_partial_payload` → 400). Most services already PATCH; `PlaylistService.ts:26` and `ReviewService.ts:26` call `update()` (PUT) with `Partial<…>` → 🔧 switch to PATCH |
| Filters / search / ordering | 🔧 | backend param names per viewset in inventory §9 (e.g. tasks: `assignee`, `assignee_id`, `entity_type`, `priority`, `shot_id`…); unknown params are silently ignored, so wrong names fail silently — align in each phase |
| `archived/`, `archive/`, `restore/` | ➕ | unused on every production resource except versions |
| `bulk-create/`, `bulk-update/`, `bulk-archive/`, `bulk-restore/` (shots, assets, sequences, episodes, tasks); `bulk-assign`, `bulk-status`, `bulk-delete` (tasks) | ✅ routes / 🔧 payloads | wired via `RESTShotAdapter.ts:35-60` and siblings; request/response shapes (`BulkOperationResponse`) to verify against the backend per phase |
| `check-existence/` | ✅ shots/assets/tasks/episodes/sequences, ➕ others | code uniqueness |
| `rename-code/` (shots, assets; `production.code.rename`) | ➕ | |
| Status transitions: shot `approve`; version `publish`/`unpublish`/`promote`; timelog `approve`/`reject`; review `submit`/`start-review`/`approve`/`reject`/`request-changes`/`close`/`verdict`/`participant-verdict`; workflow `activate`/`deactivate`/`clone`/`simulate` | ✅ mostly / ➕ `promote` | |
| `status-history/` (shots, tasks, versions, timelogs, reviews) | ➕ | History tab source |
| Shot ⇄ asset links (`shots/{id}/assets/`, `assets/{id}/shots/`) | ✅ | |
| Review comments/notes/annotations/participants/versions | ✅ / ➕ participants add/remove | |
| Playlists: entries, reorder, share | ✅ | |
| Task templates: CRUD, `apply`, `copy-to-project` | ➕ | |
| Project dashboard / statistics | ✅ dashboard / ➕ statistics | `features/dashboard` |
| Project-scoped tree `/api/organizations/projects/{id}/*` (summary, members, notes, activity, pipeline, resources, schedule, files, deliveries, editorial, lists) | 🔧 | 16/17 wired in `projectScopedApi.ts`, but **14 workspace tabs don't use them** (Activity, Attachments, Calendar, Deliveries, Media, Overview, Pipeline, Playlists, Publishing, Resources, Reviews, Schedule, Timelogs, Workflow render empty fallbacks) → wire tabs to these views or to `?project=` filters; types from samples (CR-08) |
| Analytics `/analytics/{kpis,departments}` | ➕ | dashboard widgets |
| Automations `/automations/{rules,audit-logs}` | ✅ | workflows module |

### 2.4 Deliveries

| Feature | Status | Detail |
|---|---|---|
| CRUD `/deliveries/` | ✅ routes / 🔧 fields | `RESTDeliveryAdapter`; no TS type matching `DeliveryPackage` found (`Delivery` interface ≠ backend serializer) |
| Actions `prepare`, `submit`, `approve`, `reject`, `cancel`, `complete`, `retry` | ✅ | |
| Actions `validate`, `revise`, `reopen`, `sign-off`, `add-version`, `remove-version` | ➕ | |
| `history/`, `qc/` (unpaginated) | ➕ | detail tabs |
| `passcode/` (`delivery.view_secret`) | ➕ | reveal-once UI |
| `bulk-cancel/` | ➕ | |
| Destinations `/deliveries/destinations/` | ✅ list (`RESTDeliveryAdapter.ts:219-225`) / verify CRUD | |
| "publish" permission `delivery.publish` | 🔧 | backend: `delivery.send` |

### 2.5 Publishing

| Feature | Status | Detail |
|---|---|---|
| Publishes CRUD + `validate`, `retry`, `republish`, `unpublish` | ✅ | `RESTPublishingAdapter` |
| `start-export`, `complete-export`, `fail` | ➕ (if UI-driven; may be pipeline-only — Q5) | |
| Published files (+ `bulk-register`, `deprecate`, `revoke`, `restore`) | ➕ | |
| Destinations | ✅ CRUD (`RESTPublishingAdapter.ts:105-140`) | |
| Storage roots (`publishing.storage.manage`) | ➕ | admin screen |

### 2.6 Scheduling

| Feature | Status | Detail |
|---|---|---|
| Resources (list/create/update), `book`, `block` | ✅ list / ➕ book, block | bare arrays |
| Events + `update-status` | ✅ / ➕ | |
| Holidays | ✅ | |
| Leaves + `approve`/`reject` | ✅ list / ➕ approve-reject | `schedule.approve` |
| Capacity, overbooking, resolve-overbooking | ✅ | |
| Bookings `/scheduling/schedules/` (+ `bulk-delete`) | ➕ | the core booking grid |
| Work calendars (+ `set-default`), milestones (+ `complete`/`reopen`) | ➕ | |
| Rates (`schedule.view_rates`) | 🔧 | field visibility |

### 2.7 Audit / activity

| Feature | Status | Detail |
|---|---|---|
| Audit logs page | ✅ | uses `/audit/` (frontend-shaped, paginated) |
| Change logs, API requests, background jobs (+cancel/retry), error logs (+resolve), tracks | ✅ routes / 🔧 permission codes (`*_logs.view` → `audit.view`, actions → `audit.update`) | |
| Login history page | 🔧 | `/audit/login-history` → `/identity/login-history/` |
| Activity feed | ✅ `/activity/` / 🗑️ client-side `activityService` buffer and `recordActivity` on login/logout | |
| **Per-object History panel** on detail pages | ➕ | ChangeLog `?target_type=&target_id=` + `status-history/`; AuditLog per object ⚠️ CR-03; untracked models ⚠️ CR-04 |
| Activity audit of frontend writes (`trackEntityMutation` POSTs to `/audit/` in mock mode) | 🗑️ | backend records writes itself |

### 2.8 Settings

| Feature | Status | Detail |
|---|---|---|
| System settings (+lock/unlock), feature flags (+enable/disable/schedule), themes (+activate), localizations (+activate), categories, definitions | ➕ (0/26 routes used) | ⚠️ CR-02 (`settings.view` unseeded → only superusers can read most of them) |
| `SettingsPage` "Mock DB Schema & Export", `DatabaseSchemaSection` | 🗑️ | |
| `/settings` route redirects to `/platform/admin/pipeline` | question Q3 | |

### 2.9 Core

| Feature | Status | Detail |
|---|---|---|
| Attachments | 🔧 | frontend uses compat `/attachments/` (bare array); canonical `/core/attachments/` (paginated) + `download/` unused |
| Tags `/core/tags/` | ➕ | |
| Version info `/info/version/` | ✅ | |

## 3. Field-level spot check (frontend TS interface vs backend detail serializer)

Generated from `frontend/src/types/*.ts` and the live OpenAPI components. "TS-only" fields do not exist on the backend response (unless an adapter fabricates them); "BE-only" fields are never typed or shown.

| Frontend type | Backend serializer | TS fields | BE fields | Shared | TS-only (examples) | BE-only |
|---|---|---|---|---|---|---|
| `Project` | `ProjectDetail` | 20 | 34 | 11 | `financials`, `is_episodic`, `producer_id`, `producer_name`, `project_type` | 23 |
| `Shot` | `ShotDetail` | 22 | 27 | 14 | `cut_info`, `department_lead_id`, `due_date`, `episode_code`, `plate_info` | 13 |
| `Asset` | `AssetDetail` | 38 | 34 | 28 | `approved_by_id`, `bounding_box`, `children_count`, `review_status` | 6 |
| `Task` | `TaskDetail` | 19 | 46 | 19 | — | 27 |
| `ReviewSession` | `ReviewDetail` | 21 | 24 | 10 | `activities`, `attendee_ids`, `leader_id`, `name` | 14 |
| `Playlist` | `PlaylistDetail` | 21 | 14 | 9 | `author_id`, `author_name`, `is_locked`, `items_count` | 5 |
| `Timelog` | `TimelogDetail` | 12 | 26 | 6 | `hours`, `log_date`, `user_id`, `category` | 20 |
| `Sequence` | `SequenceDetail` | 14 | 24 | 10 | `approved_shots`, `episode_code`, `shot_count` | 14 |
| `Episode` | `EpisodeDetail` | 18 | 22 | 15 | `archived`, `sequence_count`, `shot_count` | 7 |
| `Workflow` | `WorkflowDetail` | 12 | 16 | 7 | `graph`, `status`, `target_entity_type`, `version` | 9 |
| `Person` | `Person` | 20 | 24 | 10 | `active_tasks`, `avatar_url`, `department_id`, `is_active`, `logged_hours` | 14 |
| `Client` | `Client` | 13 | 16 | 12 | `active_projects` | 4 |

Every module phase therefore starts with regenerated types and a field-by-field mapping.

## 4. 🗑️ REMOVE candidates (proposed — each needs your OK; removal happens in a separate commit in its phase)

| Item | Why | Phase |
|---|---|---|
| `core/testing/**` (TestRunnerEngine + suites) and the `/testing` route, `testing.view` code | calls mock-only `/api/projects/proj-001/...`, `?mock_error=`; replaced by Vitest + Playwright | 1 |
| `modules/platform/health/apiHealthData.ts` stale probe list | 16 non-existent paths | 1 |
| `core/auth/demoUserUtils.ts`, `modules/auth/hooks/useDemoUsers.ts`, `getDemoUsers` | mock concept, always `[]` | 1 |
| Client-side role matrix and engines without backend backing (`ROLE_PERMISSIONS`, `systemRoles.ts`, `permissionCatalog.ts`, `routePermissionsRegistry.ts` codes, `fieldPermissionEngine`, `externalAccessEngine`, `scopeEngine`, `workflowStateEngine`, `bulkAuthorizationEngine`, `enterprisePermissions`, `core/access/domainPermissions.ts`) | 290 invented codes; second source of truth | 1 (replace, then delete) |
| `core/activity/activityService.ts` buffer, `useActivityStore.recordActivity` on login/logout, `shared/hooks/trackEntityMutation.ts` audit POST | fake client audit; backend audits | 1 / 3 |
| `ContractValidator` runtime checks on the stale contract | false positives; regenerate or drop | 1 |
| `modules/platform/pages/ReportsPage.tsx` (+ `/reports/` call), `NotificationsPage.tsx`, `DataPlatformPage.tsx` | backend apps removed | 5 (question Q2) |
| `PlatformAdminPage` "push mock roles" seeding | mock-era | 2 |
| `SettingsPage` mock DB schema/export section, `DatabaseSchemaSection.tsx` | mock-era | 5 |
| `people/api/personApi.ts` `setPassword` (`/people/{id}/set-password/`) | no backend route | 2 |
| `features/organizations/` (empty) | dead | 1 |
| Empty project-tab fallbacks (`projectDeliverablesFallback`, …) | replaced when the tabs are wired | 4 |
| Frontend `CLAUDE.md` mock/MSW/intelligence sections | stale | 1 (docs) |

## 5. ⚠️ BACKEND-GAP summary

| ID | Gap | Frontend impact | Workaround |
|---|---|---|---|
| CR-01 | stale deprecation headers on directory/RBAC routes | cosmetic, generated types flag them deprecated | ignore |
| CR-02 | 18 enforced permission codes never seeded | settings, user lifecycle, security ledgers usable by superusers only | superuser-only UI until resolved |
| CR-03 | AuditLog has no `target_id` filter | per-object audit panel incomplete | ChangeLog + status-history only |
| CR-04 | ChangeLog misses several editable models | empty History tabs for them | "no history recorded" state |
| CR-05 | broken seed commands | no seeded dev DB for e2e | factories in test DB |
| CR-06 | 403 instead of 405 for unmapped methods | none | — |
| CR-07 | superuser fallback permission list | wrong gates if trusted | `is_superuser` ⇒ all |
| CR-08 | 19 views not in the schema | hand-typed | samples |
| CR-09 | page-size doc drift | none | — |
| Q-01 | contacts 403 for non-directory users | contacts tab hidden for them | treat 403 as no-access |

## 6. Questions for you (business intent — not assumed)

1. **Users vs People.** The frontend's People module edits `masterdata.Person`; there is no UI for identity `User` administration. Should Phase 2 add a Users admin (create, activate/suspend, reset password, sessions) separate from People, linked through `people/{id}/link-user/`?
2. **Reports / Notifications / Data Platform pages**: remove, or keep as hidden placeholders until a backend exists?
3. **`/settings` route**: it redirects to `/platform/admin/pipeline`. Should the new Settings admin (system settings, feature flags, themes, localization) live under `/settings` or under Platform Admin?
4. **Export**: the backend has no export endpoints. Do you want client-side CSV export of the current table view, or nothing until the backend adds export?
5. **Publishing `start-export` / `complete-export` / `fail`**: these look like pipeline/worker callbacks. Expose them in the UI or leave them to automation?
6. **Token storage**: OK to move the access token to memory and the refresh token to `sessionStorage` (one login per browser tab session, plus the cross-tab lock)? The alternative (httpOnly cookie) needs a backend change I am not proposing.
7. **Superuser-only screens (CR-02)**: ship them gated to superusers now, or wait for CR-02?
