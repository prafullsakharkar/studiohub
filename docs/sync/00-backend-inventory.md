# 00 — Backend inventory (Phase 0, read-only)

Branch `sync/phase-0-discovery`, captured 2026-10-29 from `develop` @ `851c80b`. The backend is the contract; nothing here was changed in `backend/`.

## 0. How this was produced (evidence trail)

| Source | What it gave | Tool |
|---|---|---|
| Django URL resolver | 506 distinct API paths (1,559 patterns incl. admin and `.format` suffixes) | [`tools/urls_dump.py`](tools/urls_dump.py) |
| Viewset class attributes | permission maps, pagination, filters, search, ordering, auth, parsers for 134 views | [`tools/views_meta.py`](tools/views_meta.py) |
| `manage.py spectacular` | OpenAPI 3 schema: 780 operations, 357 components | `uv run python manage.py spectacular` |
| Model `_meta` | 106 models across 9 apps | [`tools/models_dump.py`](tools/models_dump.py) |
| Live requests | 133 sample files, success + 400/401/403/404/405/409 | [`tools/test_capture_samples.py`](tools/test_capture_samples.py) → [`samples/`](samples/) |
| `init_platform` specs | permission catalog (127 codes) and role matrix (7 roles) | [`tools/perm_catalog.py`](tools/perm_catalog.py) |

**How the samples were captured.** A pytest module run against the pytest test database (guarded: it asserts the DB name is test-prefixed), inside one transaction that is rolled back. It seeds `init_platform` plus the backend's own test factories (`apps/*/tests/factories.py`), then calls every list route as four principals: superuser, anonymous, a user with no roles (`norole`) and a user holding the seeded `artist` role. For each list it also fetches one detail, a random-UUID 404, `POST {}` (400) and a no-role `POST` (403). Tokens, secrets and e-mail addresses are redacted; long strings are truncated. Nothing touches the live `.env.local` database.

Two seed commands are broken and could not be used (logged in [backend-change-requests.md](backend-change-requests.md) as dev-tooling findings, not API defects):
- `seed_studiohub` / `seed_demo_data` read `frontend/src/mocks/db`, which no longer exists (MSW was removed).
- `seed_dev` imports `approve_delivery` from `apps.deliveries.services.delivery`, which no longer exists.

Deliveries, publishing and scheduling have no factories, so their samples show the empty envelope and validation errors only; their field shapes come from the OpenAPI serializers ([00b-backend-serializers.md](00b-backend-serializers.md)). Full detail samples for those apps are captured at the start of their module phases.

## 1. Apps

`INSTALLED_APPS` local apps: `core`, `identity`, `settings`, `audit`, `production`, `deliveries`, `publishing`, `scheduling`, `masterdata`. The former `organization`, `intelligence` and `platform` apps are gone (CLAUDE.md, ADR-0034).

| App | Models | API paths | Mount | Role |
|---|---|---|---|---|
| core | 2 (Tag, Attachment) | 8 | `/api/v1/core/`, `/api/v1/attachments/` (compat), `/api/v1/info/` | shared kernel, files |
| identity | 21 | 89 | `/api/v1/auth/`, `/api/v1/identity/`, `/api/v1/{roles,groups,permissions}/` | auth, users, sessions, MFA, RBAC, credentials |
| masterdata | 19 | 60 | `/api/v1/{departments,teams,offices,positions,people,clients,vendors,…}/`, `/api/v1/platform/master-data/*`, `/api/v1/platform/overview` | directory + catalog (types, statuses, software) |
| audit | 7 | 22 | `/api/v1/audit/*`, `/api/v1/activity/` | audit logs, change logs, activity, api requests, jobs, errors, tracks |
| settings | 6 | 26 | `/api/v1/settings/*` | system settings, feature flags, themes, localization |
| production | 30 | 205 | `/api/v1/{projects,shows,episodes,sequences,shots,assets,tasks,timelogs,versions,reviews,playlists,media,workflows,task-templates,editorial}/`, `/api/organizations/projects/{project_id}/*`, `/api/v1/analytics/*`, `/api/v1/automations/*` | the production core |
| deliveries | 7 | 22 | `/api/v1/deliveries/*` | client deliveries |
| publishing | 7 | 20 | `/api/v1/publishing/*` | publishes, published files, storage roots |
| scheduling | 7 | 27 | `/api/v1/scheduling/*` | resources, bookings, leaves, holidays, calendars, milestones, capacity |

Cross-app references (ForeignKey targets, from the model dump in §9) that drive phase order:
- **identity.User** is referenced by almost everything (`created_by`/`updated_by`, assignees, reviewers, supervisors).
- **masterdata** (Department, Team, Person, Client, Vendor, statuses/types) is referenced by production (tasks, project memberships), deliveries (client), scheduling (resources → person/department).
- **production.Project** is referenced by deliveries, publishing, scheduling (bookings, milestones) and the audit change log.
- **production.Version** is referenced by deliveries (delivery items), publishing (publish items), reviews and playlists.
- **audit** references only identity.User (actor) and stores target type/id as strings.

## 2. Global REST configuration

Source: `backend/config/settings/components/drf.py`, `jwt.py`, `cors.py`.

| Setting | Value | Notes |
|---|---|---|
| Authentication chain | `SessionBoundJWTAuthentication` → `PersonalAccessTokenAuthentication` → `APIKeyAuthentication` | Browser clients use JWT only: `Authorization: Bearer <access>`. PATs share the `Bearer` keyword; API keys use the `Api-Key` header. |
| Default permission | `IsAuthenticated` | Most viewsets add `HasPermission` with a per-action `permission_map` (see the endpoint tables). |
| Pagination | `StandardPagination` (page-number) | `?page=` + `?page_size=` (alias `?limit=`), **default 25** (class attribute; `PAGE_SIZE: 20` in settings is overridden — `CONTRACTS.md` API-GEN-04 says 20, which is wrong), max 500. Envelope `{count, next, previous, results}`; `next`/`previous` are absolute URLs. Out-of-range page → **404** `{"detail":"Invalid page."}`. Verified: [samples/_misc/conflicts_and_pagination.json](samples/_misc/conflicts_and_pagination.json). |
| Unpaginated lists | 32 list endpoints return a **bare JSON array** | identity admin lists, masterdata catalog, scheduling, settings, media, `/audit/activities/`, `/audit/audit-logs/`, `/attachments/`. See §4. |
| Filter backends | `DjangoFilterBackend`, `OrderingFilter` (`?ordering=field,-field`), `SearchFilter` (`?search=`) | Unknown `ordering` field is **silently ignored** (200). Invalid filter value (e.g. non-UUID `project`) returns **200 with zero rows**, not 400. |
| Renderers | JSON + Browsable API | CSV/Excel renderers exist in core but no route uses them; there is **no export endpoint** anywhere. |
| Parsers | JSON, Form, MultiPart on every view | uploads are multipart (`/core/attachments/`). |
| Throttling | scoped only: `login` 30/min, `refresh` 60/min, `password_reset` 5/min, `sensitive` 20/min, `upload` 60/hour | login/refresh/MFA challenge use `FailClosedScopedRateThrottle`. 429 carries `Retry-After`. |
| JWT | access 30 min, refresh 7 days, **rotate on refresh + blacklist after rotation**, session absolute lifetime 30 days, idle timeout from env | Refresh-token reuse **revokes the whole session** (verified). |
| CORS | `CORS_ALLOW_CREDENTIALS=True`; extra headers `x-organization-id`, `x-organization`; allow-all only when `DEBUG` | The organization headers are vestigial (no org tenancy any more). |
| CSRF | not involved for the SPA: JWT in the `Authorization` header, no session cookie auth in the DRF chain | The MFA "remember device" flow sets a cookie (`MFAService.create_cookie`). |
| Schema | `/api/schema/` + `/api/schema/swagger-ui/`, **authenticated callers only**, toggled by env | the frontend generator must fetch it with a token or use the committed file. |
| Request IDs | every error body carries `error.request_id`, mirrored in the `X-Request-ID` response header | use for support/correlation. |
| Deprecation | `DeprecationHeaderMiddleware` adds `Deprecation: true` + `Sunset: Mon, 01 Mar 2027` to deprecated paths | see §7: the registry is stale for the flat directory/RBAC routes. |

## 3. Error response format (verified)

Source: `apps/core/api/exceptions/handlers.py` (`custom_exception_handler`, frozen by `CONTRACTS.md` API-GEN-06). Bodies are **flat DRF bodies** plus an additive `error` object:

| Case | Status | Body (real sample) |
|---|---|---|
| Field validation | 400 | `{"code": ["project with this code already exists."], "error": {"code": "validation_error", "request_id": "…"}}` |
| Required fields | 400 | `{"email": ["This field is required."], "password": ["This field is required."], "error": {…}}` |
| Non-field validation | 400 | `{"non_field_errors": ["…"], "error": {…}}` (DRF default key) |
| Service-layer `DjangoValidationError` | 400 | same field-map shape (`as_serializer_error`) |
| Bad credentials | 401 | `{"detail": "Invalid username or password.", "error": {"code": "authentication_failed", …}}` |
| Invalid/expired access token | 401 | SimpleJWT body: `{"detail": "Given token not valid for any token type", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "Token is invalid"}], "error": {"code": "token_not_valid", …}}` |
| Revoked session (after logout / refresh reuse) | 401 | `{"detail": "Session is no longer active.", "error": {"code": "session_expired", …}}` / `{"detail": "Session has been revoked.", "error": {"code": "authentication_failed"}}` |
| Missing permission | 403 | `{"detail": "You do not have permission to perform this action.", "error": {"code": "permission_denied", …}}` |
| Not found | 404 | `{"detail": "No <Model> matches the given query."}` (56 viewsets) or `{"detail": "Not found."}` (23, production/masterdata catalog), + `error.code = "not_found"` |
| Method not allowed | 405 | `{"detail": "Method \"PATCH\" not allowed.", "error": {"code": "method_not_allowed"}}` + `Allow` header |
| Delete of a referenced row | 409 | `{"detail": "Still referenced by: masterdata.Position.department (2), masterdata.Team.department (1).", "error": {"code": "has_dependants"}}` |
| DB integrity race | 409 | `{"detail": "Resource conflict: the request conflicts with existing data.", "error": {"code": …}}` |
| Locked resource | 423 | `{"detail": "Resource is locked."}` (`ResourceLockedException`) |
| Throttled | 429 | DRF default `{"detail": "Request was throttled. Expected available in N seconds."}` + `error` + `Retry-After` header (not captured live: throttles are scoped and would need 30+ requests) |
| Unhandled | 500 | `{"detail": "Internal server error.", "error": {…}}`; also written to `audit.ErrorLog` |

Normalization rule for the frontend: `message` = `detail` (string) → else `non_field_errors.join` → else first field error; `fieldErrors` = every key whose value is a string array (or a nested object/array of objects for nested serializers) **except** `detail`, `code`, `messages`, `non_field_errors`, `error`; `code` = `error.code` (preferred) or top-level `code`; `requestId` = `error.request_id`. Unique-constraint violations arrive as **400 field errors**, not 409 (verified with a duplicate project code).

## 4. Pagination and list shapes

- **Paginated (46 lists):** all production resources, deliveries, publishing, masterdata directory (departments, teams, offices, positions, people, clients, vendors, contacts, contracts), RBAC (`roles`, `groups`, `permissions`), audit (except two), `core/attachments`, `core/tags`, credentials (`api-keys`, `personal-access-tokens`), project-scoped list views.
- **Bare array (32 lists):** `audit/activities`, `audit/audit-logs`, `attachments` (compat), `identity/{users, profiles, sessions, trusted-devices, login-attempts, login-history, security-events, ip-blacklist}`, `platform/master-data/*` (7), `media`, `scheduling/*` (7), `settings/*` (6). Every one was observed as a bare array in the samples. The frontend must not assume `{results}` for these (see gap analysis).
- `?page_size` above 500 is clamped to 500; `?limit` works as an alias; search with no match returns `{count: 0, results: []}`.

## 5. Auth flow (verified end to end through the real JWT chain)

Samples: [samples/identity/_auth_flow.json](samples/identity/_auth_flow.json), [samples/identity/_auth_logout_flow.json](samples/identity/_auth_logout_flow.json).

1. `POST /api/v1/auth/login/` `{email, password}` → `200 {"tokens": {"access", "refresh"}, "user": FrontendUser}`.
   - With MFA enabled: `200 {"mfa_required": true, "challenge": "<signed>", "expires_in": 300}` and **no tokens**; finish with `POST /api/v1/auth/mfa/challenge/` `{challenge, code | recovery_code, remember_device?}` → `{tokens, user}` (API-MFA-09).
   - When policy requires MFA but the user has none: the success body also has `"mfa_enrollment_required": true`.
   - `user.must_change_password: true` → the client must route to change-password.
2. Authenticated calls: `Authorization: Bearer <access>`.
3. `POST /api/v1/auth/refresh/` `{refresh}` → `200 {"access", "refresh"}` (**rotated**; store both). Replaying an already-rotated refresh token → `401 "Session has been revoked."` and the **session is revoked** (subsequent calls with its access token → `401 session_expired`). Consequence: refresh must be single-flight **across tabs**.
4. `POST /api/v1/auth/logout/` `{refresh?}` (requires a valid access token) → `200 {"detail": "Logged out successfully."}`; afterwards access → 401 `session_expired`, refresh → 401.
5. `GET /api/v1/auth/me/` → `FrontendUser`; `PATCH /api/v1/auth/me/` with Profile fields (`first_name, last_name, display_name, avatar_url, phone, bio, timezone, language, preferences`).
6. `POST /api/v1/auth/change-password/`, `POST /api/v1/auth/forgot-password/` (always `200 {"detail": "If an account exists, …"}` — anti-enumeration), `POST /api/v1/auth/reset-password/`.
7. Deprecated duplicates: `/api/v1/identity/{login,logout,refresh}/` (Sunset 2027-03-01).

`FrontendUser` (`apps/identity/api/serializers/frontend_user.py`):
```
id, email, first_name, last_name, full_name, avatar_url, role (display name of the highest-priority role, default "Artist"),
permissions: string[] (PermissionResolver), project_memberships: [{id, user_id, project_id, project_code, show_id, role, roles[],
scope, status, department, department_id, team_id, vendor_id, client_id}], is_active, is_staff, is_superuser,
must_change_password, created_at, updated_at
```

## 6. Roles, permissions and how the frontend learns them

- Model: flat RBAC (ADR-0033/0017/0032). `Permission` (code, module, action, category), `Role` (code, priority, scope), `Group`; assignments `UserRole`, `GroupMember`, `GroupRole`, `RolePermission` (with optional `expires_at`). No tenant column. Project scope lives in `production.ProjectMembership`.
- Enforcement: `HasPermission` reads the viewset's `permission_map[action]` (a tuple of codes; empty tuple = authenticated is enough); superusers pass every check. Querysets add project-membership scoping (e.g. `artist` gets 404, not 403, on project-scoped views of projects they are not a member of — see the project-scoped samples).
- The client learns permissions **only** from `FrontendUser.permissions` (`/auth/me/`, login). There is no separate "my permissions" endpoint; `GET /permissions/` lists the catalog.
- **Superuser caveat:** a superuser with no role grants gets a hard-coded fallback list of 23 codes in `permissions` (`frontend_user.py`), several of which are not real catalog codes (`user.manage`, `settings.update`). The backend itself lets a superuser do everything, so the UI must treat `is_superuser === true` as "all permissions", not trust that list.
- Catalog: 127 codes seeded by `init_platform`; 126 distinct codes referenced by `permission_map`s. **18 enforced codes are never seeded** (`settings.view`, `identity.user.{activate,archive,deactivate,restore,reset_password,change_password}`, `identity.{ip_blacklist,login_attempt,login_history,security_event}.*`, `identity.profile.delete`, `identity.trusted_device.delete`): only superusers can pass those checks today → change request CR-03.
- Codes seeded but not referenced by any view: field/override codes used inside services and serializers (`masterdata.client.view_financial`, `masterdata.person.view_sensitive`, `schedule.view_rates`, `timelog.view_all`, `*.sod.override`, `*.status.override`, `masterdata.hard_delete`, `tasktemplate.manage_studio`). The UI should use them to decide which sensitive fields/overrides to show.
- Seeded roles (code → number of codes): `platform-admin` (all), `org-admin` 102, `production-admin` 95, `vfx-supervisor` 89, `lead-artist` 41, `artist` 25, `org-member` (minimal).

Permission codes per domain (as enforced; full list in [tools/perm_catalog.py](tools/perm_catalog.py) output):
- production: `project|show|episode|sequence|shot|asset|task|timelog|version|review|playlist|media|workflow|track|tasktemplate` × `view|create|update|delete` plus `shot.approve`, `review.approve`, `timelog.approve`, `version.publish`, `production.code.rename`
- deliveries: `delivery.{view,create,update,delete,approve,send,view_secret}`; publishing: `publishing.{view,create,update,delete,deprecate,revoke,storage.manage}`; scheduling: `schedule.{view,create,update,delete,manage,approve}`
- masterdata: reads need only authentication; writes need `masterdata.directory.manage` (directory) or `masterdata.catalog.manage` (catalog)
- identity: `identity.user.*`, `identity.role|group|permission.{create,update,delete}` (reads: authenticated), credentials/sessions are owner-scoped
- audit: `audit.view`, `audit.update` (resolve/cancel/retry); settings: `settings.manage` (+ the unseeded `settings.view`)

## 7. Audit and history mechanisms

Five independent ledgers in `apps/audit` (all append-only, platform-global), plus domain-specific status histories:

| Ledger | Written by | Read endpoint | Filters (query params) | Notes |
|---|---|---|---|---|
| **ChangeLog** (field diffs) | `post_save`/`post_delete` signals in `apps/audit/signals/change_tracking.py` for an explicit model list | `/api/v1/audit/change-logs/` | `change_type`, `target_type`, **`target_id`**, `user`, `created_at[__gte,__lte]`; search `target_type,target_name,description` | `before_values`/`after_values` per field; actor from the thread-local request. **This is the per-object history source.** |
| **AuditLog** (security/business actions) | `deliveries/services/audit.py`, `publishing/services/audit.py`, `scheduling/services/audit.py`, `masterdata/events/handlers.py`, attachment events (`audit/events/handlers.py`) | `/api/v1/audit/audit-logs/` (bare array), `/api/v1/audit/` (frontend-shaped, paginated) | `action`, `actor`, `target_type`, `severity`, `created_at[...]` | **no `target_id` filter** → can't fetch one object's AuditLog rows (CR-05). |
| **Activity** (user activity feed) | `ActivityService` (review comments, logins…) | `/api/v1/audit/activities/` (bare), `/api/v1/activity/` and `/api/v1/audit/activity/` (frontend-shaped, paginated) | `activity_type`, `status`, `user`, `created_at[...]` | |
| **APIRequest** | telemetry middleware | `/api/v1/audit/api-requests/` | `method`, `status_code`, `user`, `created_at[...]` | |
| **ErrorLog** | exception handler (5xx) | `/api/v1/audit/error-logs/` + `POST {id}/resolve/` | `error_type`, `severity`, `user`, `created_at[...]` | |
| BackgroundJob / Track | Celery / client tracking (`POST /audit/tracks/`) | `/audit/background-jobs/` (+ `cancel`, `retry`), `/audit/tracks/` | | |
| SecurityEvent / LoginHistory / LoginAttempt | identity services | `/api/v1/identity/{security-events,login-history,login-attempts}/` | user, ip, type, date range | identity-owned (Phase 5). |
| Status histories | production state machines, deliveries | `/{shots,tasks,versions,timelogs,reviews}/{id}/status-history/`, `/deliveries/{id}/history/` | — | per-object transition log. |

**ChangeLog coverage** (`_TRACKED_MODEL_PATHS`): Project, Sequence, Shot, Asset, ShotAsset, Task, Version, Episode, Review, Timelog, ProjectMembership; DeliveryPackage; PublishItem; scheduling Resource, ResourceSchedule, ResourceLeave, CalendarEvent, Holiday, WorkCalendar, Milestone; masterdata Client, Vendor, Person, Department, Team, Office; identity UserRole, GroupMember, GroupRole, RolePermission.

**Not tracked by ChangeLog** (candidate BACKEND-GAPs, to be confirmed per module phase): production Show, Media, Playlist, EditorialTrack, Workflow, TaskTemplate; masterdata Position, contacts, contracts, all catalog types/statuses/software; settings (all six models); identity User/Role/Group/Permission rows themselves (RBAC writes emit `SecurityEvent` instead, WP 4.6); publishing PublishedFile/Destination/StorageRoot; deliveries Destination. No reason/comment field is accepted by any write endpoint for audit purposes; actor comes from the JWT, correlation from `X-Request-ID`.

## 8. Known backend quirks the frontend must live with (not defects requiring change)

- **Views missing from the OpenAPI schema** (spectacular "unable to guess serializer"): the 17 project-scoped views under `/api/organizations/projects/{project_id}/*`, `AttachmentDownloadView`, `VersionInfoView`. 35 endpoints declare `OpenApiTypes.OBJECT` responses (auth, MFA, capacity, actions). Frontend types for these are hand-written from [samples/](samples/).
- **Duplicate routes:** `check-existence/` and `existence-check/` on every production viewset; `/audit/` vs `/audit/audit-logs/`; `/activity/` vs `/audit/activity/` vs `/audit/activities/`; `/attachments/` vs `/core/attachments/`; two MFA trees (`/identity/auth/mfa/*` canonical, `/identity/mfa/*` deprecated per API-MFA-10); `/auth/*` vs `/identity/{login,logout,refresh}/`.
- `/api/organizations/projects/{project_id}/*` is live and canonical for project-scoped reads despite the "organizations" prefix (it is not in the deprecation registry). It answers 404 (not 403) for non-members.
- Methods not in a `permission_map` are denied with **403** before method dispatch on `MethodPermissionMixin` views (e.g. `GET /scheduling/resolve-overbooking/` → 403 even for a superuser, instead of 405).
- Contacts (`/client-contacts/`, `/vendor-contacts/`) answer 403 to users without directory roles although their `permission_map` list entry is empty — enforced elsewhere (PII guard); confirm in the masterdata phase.
- `CONTRACTS.md` API-GEN-04 says default page size 20; the real default is 25.

## 9. Endpoint and model reference (generated)

The tables below are generated by [`tools/gen_inventory.py`](tools/gen_inventory.py) from the resolver, viewset metadata and model `_meta`. "Sample" links show the list status as `admin/anon/norole/artist`. Request/response field tables per serializer are in [00b-backend-serializers.md](00b-backend-serializers.md).

### core — endpoints (8 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/attachments/` | GET → `list`<br>POST → `create` | CompatAttachmentViewSet | `list`: auth only<br>`create`: auth only | none (bare array) | filter: `file_type`, `is_public`<br>search: name, description, mime_type | [200/anon 401/norole 200/artist 200](samples/core/attachments.json) |
| `/api/v1/attachments/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | CompatAttachmentViewSet | `retrieve`: auth only<br>`update`: auth only<br>`partial_update`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/core/attachments/` | GET → `list`<br>POST → `create` | AttachmentViewSet | `list`: auth only<br>`create`: auth only | StandardPagination | filter: `file_type`, `is_public`<br>search: name, description, mime_type | [200/anon 401/norole 200/artist 200](samples/core/core__attachments.json) |
| `/api/v1/core/attachments/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | AttachmentViewSet | `retrieve`: auth only<br>`update`: auth only<br>`partial_update`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/core/attachments/{uuid}/download/` | APIView | AttachmentDownloadView | AllowAny |  |  |  |
| `/api/v1/core/tags/` | GET → `list`<br>POST → `create` | TagViewSet | `list`: auth only<br>`create`: auth only | BasePagination | filter: `is_system`<br>search: name, description | [200/anon 401/norole 200/artist 200](samples/core/core__tags.json) |
| `/api/v1/core/tags/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TagViewSet | `retrieve`: auth only<br>`update`: auth only<br>`partial_update`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/info/version/` | APIView | VersionInfoView | AllowAny |  |  | [200/anon 200/norole 200/artist 200](samples/core/info__version.json) |

### identity — endpoints (83 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/auth/change-password/` | APIView | AuthChangePasswordView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/auth__change-password.json) |
| `/api/v1/auth/forgot-password/` | APIView | ForgotPasswordAPIView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/auth__forgot-password.json) |
| `/api/v1/auth/login/` | APIView | AuthLoginView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/auth__login.json) |
| `/api/v1/auth/logout/` | APIView | AuthLogoutView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/auth__logout.json) |
| `/api/v1/auth/me/` | APIView | AuthMeView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/auth__me.json) |
| `/api/v1/auth/mfa/challenge/` | APIView | AuthMFAChallengeView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/auth__mfa__challenge.json) |
| `/api/v1/auth/refresh/` | APIView | AuthRefreshView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/auth__refresh.json) |
| `/api/v1/auth/reset-password/` | APIView | ResetPasswordAPIView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/auth__reset-password.json) |
| `/api/v1/groups/` | GET → `list`<br>POST → `create` | GroupViewSet | `list`: auth only<br>`create`: identity.group.create | StandardPagination | filter: `is_system`<br>search: name, code<br>ordering: name, created_at | [200/anon 401/norole 200/artist 200](samples/identity/groups.json) |
| `/api/v1/groups/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | GroupViewSet | `retrieve`: auth only<br>`update`: identity.group.update<br>`partial_update`: identity.group.update<br>`destroy`: identity.group.delete |  |  |  |
| `/api/v1/groups/{pk}/members/` | GET → `members`<br>POST → `members`<br>DELETE → `members` | GroupViewSet | `members`: identity.group.update |  |  |  |
| `/api/v1/groups/{pk}/roles/` | GET → `roles`<br>POST → `roles`<br>DELETE → `roles` | GroupViewSet | `roles`: identity.group.update |  |  |  |
| `/api/v1/identity/api-keys/` | GET → `list`<br>POST → `create` | ApiKeyViewSet | `list`: auth only<br>`create`: auth only | StandardPagination |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__api-keys.json) |
| `/api/v1/identity/api-keys/{pk}/` | GET → `retrieve`<br>DELETE → `destroy` | ApiKeyViewSet | `retrieve`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/identity/api-keys/{pk}/rotate/` | POST → `rotate` | ApiKeyViewSet | `rotate`: auth only |  |  |  |
| `/api/v1/identity/auth/mfa/devices/` | APIView | TrustedDeviceListAPIView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__auth__mfa__devices.json) |
| `/api/v1/identity/auth/mfa/devices/revoke/` | APIView | TrustedDeviceRevokeAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__auth__mfa__devices__revoke.json) |
| `/api/v1/identity/auth/mfa/disable/` | APIView | MFADisableAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__auth__mfa__disable.json) |
| `/api/v1/identity/auth/mfa/enroll/` | APIView | MFAEnrollAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__auth__mfa__enroll.json) |
| `/api/v1/identity/auth/mfa/recovery/` | APIView | MFARecoveryCodesAPIView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__auth__mfa__recovery.json) |
| `/api/v1/identity/auth/mfa/recovery/verify/` | APIView | MFARecoveryVerifyAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__auth__mfa__recovery__verify.json) |
| `/api/v1/identity/auth/mfa/verify/` | APIView | MFAVerifyAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__auth__mfa__verify.json) |
| `/api/v1/identity/email/resend/` | APIView | ResendVerificationAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__email__resend.json) |
| `/api/v1/identity/ip-blacklist/` | GET → `list`<br>POST → `create` | IPBlacklistViewSet | `list`: identity.ip_blacklist.view<br>`create`: identity.ip_blacklist.create | none (bare array) | filter: `created_by`, `description`, `expired`, `ip_address`, `is_active`, `network`, `reason`, `updated_by`, `uuid` | [200/anon 401/norole 403/artist 403](samples/identity/identity__ip-blacklist.json) |
| `/api/v1/identity/ip-blacklist/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | IPBlacklistViewSet | `retrieve`: identity.ip_blacklist.view<br>`update`: identity.ip_blacklist.update<br>`partial_update`: identity.ip_blacklist.update<br>`destroy`: identity.ip_blacklist.delete |  |  |  |
| `/api/v1/identity/ip-blacklist/{pk}/activate/` | POST → `activate` | IPBlacklistViewSet | `activate`: identity.ip_blacklist.update |  |  |  |
| `/api/v1/identity/ip-blacklist/{pk}/deactivate/` | POST → `deactivate` | IPBlacklistViewSet | `deactivate`: identity.ip_blacklist.update |  |  |  |
| `/api/v1/identity/ip-blacklist/{pk}/expire/` | POST → `expire` | IPBlacklistViewSet | `expire`: identity.ip_blacklist.update |  |  |  |
| `/api/v1/identity/login-attempts/` | GET → `list`<br>POST → `create` | LoginAttemptViewSet | `list`: identity.login_attempt.view<br>`create`: identity.login_attempt.create | none (bare array) | filter: `end_date`, `ip_address`, `reason`, `start_date`, `success`, `user`, `username` | [200/anon 401/norole 403/artist 403](samples/identity/identity__login-attempts.json) |
| `/api/v1/identity/login-attempts/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | LoginAttemptViewSet | `retrieve`: identity.login_attempt.view<br>`update`: —<br>`partial_update`: —<br>`destroy`: — |  |  |  |
| `/api/v1/identity/login-history/` | GET → `list`<br>POST → `create` | LoginHistoryViewSet | `list`: identity.login_history.view<br>`create`: — | none (bare array) | filter: `end_date`, `ip_address`, `login_type`, `start_date`, `status`, `user` | [200/anon 401/norole 403/artist 403](samples/identity/identity__login-history.json) |
| `/api/v1/identity/login-history/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | LoginHistoryViewSet | `retrieve`: identity.login_history.view<br>`update`: —<br>`partial_update`: —<br>`destroy`: — |  |  |  |
| `/api/v1/identity/login/` | APIView | LoginAPIView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/identity__login.json) |
| `/api/v1/identity/logout/` | APIView | LogoutAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__logout.json) |
| `/api/v1/identity/mfa/admin/reset/{user_id}/` | APIView | MFAAdminResetView | IsAuthenticated |  |  |  |
| `/api/v1/identity/mfa/config/` | APIView | MFAConfigView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__mfa__config.json) |
| `/api/v1/identity/mfa/recovery-codes/` | APIView | MFARecoveryCodesView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__mfa__recovery-codes.json) |
| `/api/v1/identity/mfa/recovery-codes/regenerate/` | APIView | MFARecoveryCodesRegenerateView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__mfa__recovery-codes__regenerate.json) |
| `/api/v1/identity/mfa/totp/disable/` | APIView | MFATOTPDisableView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__mfa__totp__disable.json) |
| `/api/v1/identity/mfa/totp/enable/` | APIView | MFATOTPEnableView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__mfa__totp__enable.json) |
| `/api/v1/identity/mfa/totp/setup/` | APIView | MFATOTPSetupView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__mfa__totp__setup.json) |
| `/api/v1/identity/mfa/totp/verify/` | APIView | MFATOTPVerifyView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__mfa__totp__verify.json) |
| `/api/v1/identity/password/change/` | APIView | ChangePasswordAPIView | IsAuthenticated |  |  | [405/anon 401/norole 405/artist 405](samples/identity/identity__password__change.json) |
| `/api/v1/identity/password/forgot/` | APIView | ForgotPasswordAPIView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/identity__password__forgot.json) |
| `/api/v1/identity/password/reset/` | APIView | ResetPasswordAPIView | AllowAny |  |  | [405/anon 405/norole 405/artist 405](samples/identity/identity__password__reset.json) |
| `/api/v1/identity/personal-access-tokens/` | GET → `list`<br>POST → `create` | PersonalAccessTokenViewSet | `list`: auth only<br>`create`: auth only | StandardPagination |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__personal-access-tokens.json) |
| `/api/v1/identity/personal-access-tokens/{pk}/` | GET → `retrieve`<br>DELETE → `destroy` | PersonalAccessTokenViewSet | `retrieve`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/identity/personal-access-tokens/{pk}/rotate/` | POST → `rotate` | PersonalAccessTokenViewSet | `rotate`: auth only |  |  |  |
| `/api/v1/identity/profiles/` | GET → `list`<br>POST → `create` | ProfileViewSet | `list`: auth only<br>`create`: auth only | none (bare array) | filter: `display_name`, `first_name`, `language`, `last_name`, `timezone`, `user` | [200/anon 401/norole 200/artist 200](samples/identity/identity__profiles.json) |
| `/api/v1/identity/profiles/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ProfileViewSet | `retrieve`: auth only<br>`update`: auth only<br>`partial_update`: auth only<br>`destroy`: identity.profile.delete |  |  |  |
| `/api/v1/identity/refresh/` | APIView | RefreshAPIView | — |  |  | [405/anon 405/norole 405/artist 405](samples/identity/identity__refresh.json) |
| `/api/v1/identity/security-events/` | GET → `list`<br>POST → `create` | SecurityEventViewSet | `list`: identity.security_event.view<br>`create`: identity.security_event.create | none (bare array) | filter: `end_date`, `event_type`, `ip_address`, `is_critical`, `start_date`, `user` | [200/anon 401/norole 403/artist 403](samples/identity/identity__security-events.json) |
| `/api/v1/identity/security-events/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SecurityEventViewSet | `retrieve`: identity.security_event.view<br>`update`: —<br>`partial_update`: —<br>`destroy`: — |  |  |  |
| `/api/v1/identity/sessions/` | GET → `list`<br>POST → `create` | UserSessionViewSet | `list`: auth only<br>`create`: auth only | none (bare array) |  | [200/anon 401/norole 200/artist 200](samples/identity/identity__sessions.json) |
| `/api/v1/identity/sessions/admin/{user_id}/` | GET → `admin_list` | UserSessionViewSet | `admin_list`: auth only |  |  |  |
| `/api/v1/identity/sessions/admin/{user_id}/revoke-all/` | POST → `admin_revoke_all` | UserSessionViewSet | `admin_revoke_all`: auth only |  |  |  |
| `/api/v1/identity/sessions/current/` | GET → `current` | UserSessionViewSet | `current`: auth only |  |  |  |
| `/api/v1/identity/sessions/revoke-all-other/` | POST → `revoke_all_other` | UserSessionViewSet | `revoke_all_other`: auth only |  |  |  |
| `/api/v1/identity/sessions/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | UserSessionViewSet | `retrieve`: auth only<br>`update`: auth only<br>`partial_update`: auth only<br>`destroy`: auth only |  |  |  |
| `/api/v1/identity/sessions/{pk}/activity/` | GET → `activity` | UserSessionViewSet | `activity`: auth only |  |  |  |
| `/api/v1/identity/sessions/{pk}/revoke/` | POST → `revoke` | UserSessionViewSet | `revoke`: auth only |  |  |  |
| `/api/v1/identity/trusted-devices/` | GET → `list`<br>POST → `create` | TrustedDeviceViewSet | `list`: auth only<br>`create`: — | none (bare array) | filter: `browser`, `fingerprint`, `ip_address`, `is_trusted`, `platform`, `user` | [200/anon 401/norole 200/artist 200](samples/identity/identity__trusted-devices.json) |
| `/api/v1/identity/trusted-devices/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TrustedDeviceViewSet | `retrieve`: auth only<br>`update`: —<br>`partial_update`: —<br>`destroy`: identity.trusted_device.delete |  |  |  |
| `/api/v1/identity/users/` | GET → `list`<br>POST → `create` | UserViewSet | `list`: identity.user.view<br>`create`: identity.user.create | none (bare array) | filter: `created_by`, `email`, `is_active`, `is_email_verified`, `is_staff`, `updated_by`, `uuid` | [200/anon 401/norole 403/artist 200](samples/identity/identity__users.json) |
| `/api/v1/identity/users/change_password/` | POST → `change_password` | UserViewSet | `change_password`: identity.user.change_password |  |  |  |
| `/api/v1/identity/users/me/` | GET → `me` | UserViewSet | `me`: auth only |  |  |  |
| `/api/v1/identity/users/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | UserViewSet | `retrieve`: identity.user.view<br>`update`: identity.user.update<br>`partial_update`: identity.user.update<br>`destroy`: identity.user.delete |  |  |  |
| `/api/v1/identity/users/{pk}/activate/` | POST → `activate` | UserViewSet | `activate`: identity.user.activate |  |  |  |
| `/api/v1/identity/users/{pk}/archive/` | POST → `archive` | UserViewSet | `archive`: identity.user.archive |  |  |  |
| `/api/v1/identity/users/{pk}/deactivate/` | POST → `deactivate` | UserViewSet | `deactivate`: identity.user.deactivate |  |  |  |
| `/api/v1/identity/users/{pk}/force-password-change/` | POST → `force_password_change` | UserViewSet | `force_password_change`: identity.user.update |  |  |  |
| `/api/v1/identity/users/{pk}/reset-password/` | POST → `reset_password` | UserViewSet | `reset_password`: identity.user.reset_password |  |  |  |
| `/api/v1/identity/users/{pk}/restore/` | POST → `restore` | UserViewSet | `restore`: identity.user.restore |  |  |  |
| `/api/v1/identity/users/{pk}/revoke-sessions/` | POST → `revoke_sessions` | UserViewSet | `revoke_sessions`: identity.user.update |  |  |  |
| `/api/v1/identity/users/{pk}/suspend/` | POST → `suspend` | UserViewSet | `suspend`: identity.user.deactivate |  |  |  |
| `/api/v1/identity/users/{pk}/unsuspend/` | POST → `unsuspend` | UserViewSet | `unsuspend`: identity.user.activate |  |  |  |
| `/api/v1/permissions/` | GET → `list`<br>POST → `create` | PermissionViewSet | `list`: auth only<br>`create`: identity.permission.create | StandardPagination | filter: `module`, `action`, `category`, `is_system`, `is_active`<br>search: name, code<br>ordering: module, sort_order, name, created_at | [200/anon 401/norole 200/artist 200](samples/identity/permissions.json) |
| `/api/v1/permissions/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | PermissionViewSet | `retrieve`: auth only<br>`update`: identity.permission.update<br>`partial_update`: identity.permission.update<br>`destroy`: identity.permission.delete |  |  |  |
| `/api/v1/roles/` | GET → `list`<br>POST → `create` | RoleViewSet | `list`: auth only<br>`create`: identity.role.create | StandardPagination | filter: `role_type`, `scope`, `is_system`, `is_default`, `is_active`<br>search: name, code<br>ordering: priority, sort_order, name, created_at | [200/anon 401/norole 200/artist 200](samples/identity/roles.json) |
| `/api/v1/roles/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | RoleViewSet | `retrieve`: auth only<br>`update`: identity.role.update<br>`partial_update`: identity.role.update<br>`destroy`: identity.role.delete |  |  |  |
| `/api/v1/roles/{pk}/groups/` | GET → `groups`<br>POST → `groups`<br>DELETE → `groups` | RoleViewSet | `groups`: identity.role.update |  |  |  |
| `/api/v1/roles/{pk}/permissions/` | GET → `permissions`<br>POST → `permissions`<br>DELETE → `permissions` | RoleViewSet | `permissions`: identity.role.update |  |  |  |
| `/api/v1/roles/{pk}/users/` | GET → `users`<br>POST → `users`<br>DELETE → `users` | RoleViewSet | `users`: identity.role.update |  |  |  |

### masterdata — endpoints (83 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/client-contacts/` | GET → `list`<br>POST → `create` | ClientContactViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `client`, `is_primary`<br>search: name, email<br>ordering: name, created_at | [200/anon 401/norole 403/artist 403](samples/masterdata/client-contacts.json) |
| `/api/v1/client-contacts/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ClientContactViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/client-contacts/{pk}/restore/` | POST → `restore` | ClientContactViewSet | `restore`: — |  |  |  |
| `/api/v1/client-contracts/` | GET → `list`<br>POST → `create` | ClientContractViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `client`, `status`, `type`<br>search: contract_number, title<br>ordering: contract_number, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/client-contracts.json) |
| `/api/v1/client-contracts/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ClientContractViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/client-contracts/{pk}/activate/` | POST → `activate` | ClientContractViewSet | `activate`: — |  |  |  |
| `/api/v1/client-contracts/{pk}/adjust-end-date/` | POST → `adjust_end_date` | ClientContractViewSet | `adjust_end_date`: — |  |  |  |
| `/api/v1/client-contracts/{pk}/restore/` | POST → `restore` | ClientContractViewSet | `restore`: — |  |  |  |
| `/api/v1/client-contracts/{pk}/terminate/` | POST → `terminate` | ClientContractViewSet | `terminate`: — |  |  |  |
| `/api/v1/clients/` | GET → `list`<br>POST → `create` | ClientViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `status`, `studio_type`<br>search: name, code, contact_name<br>ordering: name, code, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/clients.json) |
| `/api/v1/clients/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ClientViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/clients/{pk}/restore/` | POST → `restore` | ClientViewSet | `restore`: — |  |  |  |
| `/api/v1/departments/` | GET → `list`<br>POST → `create` | DepartmentViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `department_type`, `parent`<br>search: name, code<br>ordering: name, code, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/departments.json) |
| `/api/v1/departments/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | DepartmentViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/departments/{pk}/restore/` | POST → `restore` | DepartmentViewSet | `restore`: — |  |  |  |
| `/api/v1/offices/` | GET → `list`<br>POST → `create` | OfficeViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `country`, `city`, `is_active`, `is_headquarters`<br>search: name, code, city<br>ordering: name, code, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/offices.json) |
| `/api/v1/offices/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | OfficeViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/offices/{pk}/restore/` | POST → `restore` | OfficeViewSet | `restore`: — |  |  |  |
| `/api/v1/people/` | GET → `list`<br>POST → `create` | PersonViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `status`, `department`, `team`, `office`<br>search: name, email<br>ordering: name, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/people.json) |
| `/api/v1/people/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | PersonViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/people/{pk}/deactivate/` | POST → `deactivate` | PersonViewSet | `deactivate`: — |  |  |  |
| `/api/v1/people/{pk}/link-user/` | POST → `link_user` | PersonViewSet | `link_user`: — |  |  |  |
| `/api/v1/people/{pk}/reactivate/` | POST → `reactivate` | PersonViewSet | `reactivate`: — |  |  |  |
| `/api/v1/people/{pk}/restore/` | POST → `restore` | PersonViewSet | `restore`: — |  |  |  |
| `/api/v1/people/{pk}/unlink-user/` | POST → `unlink_user` | PersonViewSet | `unlink_user`: — |  |  |  |
| `/api/v1/platform/master-data/asset-types` | GET → `list`<br>POST → `create` | MasterAssetTypeViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`<br>search: name, code<br>ordering: name, sort_order | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__asset-types.json) |
| `/api/v1/platform/master-data/asset-types/reorder` | POST → `reorder` | MasterAssetTypeViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/asset-types/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterAssetTypeViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/asset-types/{pk}/archive` | POST → `archive` | MasterAssetTypeViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/asset-types/{pk}/restore` | POST → `restore` | MasterAssetTypeViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/file-types` | GET → `list`<br>POST → `create` | MasterFileTypeViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`, `category`<br>search: name, extension<br>ordering: name, sort_order | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__file-types.json) |
| `/api/v1/platform/master-data/file-types/reorder` | POST → `reorder` | MasterFileTypeViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/file-types/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterFileTypeViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/file-types/{pk}/archive` | POST → `archive` | MasterFileTypeViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/file-types/{pk}/restore` | POST → `restore` | MasterFileTypeViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/review-types` | GET → `list`<br>POST → `create` | MasterReviewTypeViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`<br>search: name, code<br>ordering: name, sort_order | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__review-types.json) |
| `/api/v1/platform/master-data/review-types/reorder` | POST → `reorder` | MasterReviewTypeViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/review-types/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterReviewTypeViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/review-types/{pk}/archive` | POST → `archive` | MasterReviewTypeViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/review-types/{pk}/restore` | POST → `restore` | MasterReviewTypeViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/shot-types` | GET → `list`<br>POST → `create` | MasterShotTypeViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`<br>search: name, code<br>ordering: name, sort_order | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__shot-types.json) |
| `/api/v1/platform/master-data/shot-types/reorder` | POST → `reorder` | MasterShotTypeViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/shot-types/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterShotTypeViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/shot-types/{pk}/archive` | POST → `archive` | MasterShotTypeViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/shot-types/{pk}/restore` | POST → `restore` | MasterShotTypeViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software` | GET → `list`<br>POST → `create` | SoftwareViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`, `category`<br>search: name, code, publisher<br>ordering: name, sort_order, created_at, updated_at | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__software.json) |
| `/api/v1/platform/master-data/software/reorder` | POST → `reorder` | SoftwareViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SoftwareViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{pk}/archive` | POST → `archive` | SoftwareViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{pk}/restore` | POST → `restore` | SoftwareViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{software_pk}/versions` | GET → `list`<br>POST → `create` | SoftwareVersionViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`<br>search: version, version_code, name<br>ordering: version, release_date, sort_order |  |
| `/api/v1/platform/master-data/software/{software_pk}/versions/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SoftwareVersionViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{software_pk}/versions/{pk}/archive` | POST → `archive` | SoftwareVersionViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/software/{software_pk}/versions/{pk}/restore` | POST → `restore` | SoftwareVersionViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/statuses` | GET → `list`<br>POST → `create` | MasterStatusViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `entity_type`, `status`, `is_default`, `is_final`<br>search: name, code<br>ordering: order, name | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__statuses.json) |
| `/api/v1/platform/master-data/statuses/reorder` | POST → `reorder` | MasterStatusViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/statuses/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterStatusViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/statuses/{pk}/archive` | POST → `archive` | MasterStatusViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/statuses/{pk}/restore` | POST → `restore` | MasterStatusViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/task-types` | GET → `list`<br>POST → `create` | MasterTaskTypeViewSet | `list`: auth only<br>`create`: masterdata.catalog.manage | none (bare array) | filter: `status`, `category`, `department_code`<br>search: name, code<br>ordering: name, code, sort_order | [200/anon 401/norole 200/artist 200](samples/masterdata/platform__master-data__task-types.json) |
| `/api/v1/platform/master-data/task-types/reorder` | POST → `reorder` | MasterTaskTypeViewSet | `reorder`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/task-types/{pk}` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MasterTaskTypeViewSet | `retrieve`: auth only<br>`update`: masterdata.catalog.manage<br>`partial_update`: masterdata.catalog.manage<br>`destroy`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/task-types/{pk}/archive` | POST → `archive` | MasterTaskTypeViewSet | `archive`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/master-data/task-types/{pk}/restore` | POST → `restore` | MasterTaskTypeViewSet | `restore`: masterdata.catalog.manage |  |  |  |
| `/api/v1/platform/overview` | GET → `overview` | PlatformOverviewViewSet | `overview`: auth only |  |  |  |
| `/api/v1/positions/` | GET → `list`<br>POST → `create` | PositionViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `department`, `is_managerial`<br>search: name, code<br>ordering: level, name, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/positions.json) |
| `/api/v1/positions/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | PositionViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/positions/{pk}/restore/` | POST → `restore` | PositionViewSet | `restore`: — |  |  |  |
| `/api/v1/teams/` | GET → `list`<br>POST → `create` | TeamViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `department`<br>search: name, code<br>ordering: name, code, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/teams.json) |
| `/api/v1/teams/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TeamViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/teams/{pk}/restore/` | POST → `restore` | TeamViewSet | `restore`: — |  |  |  |
| `/api/v1/vendor-contacts/` | GET → `list`<br>POST → `create` | VendorContactViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `vendor`, `is_primary`<br>search: name, email<br>ordering: name, created_at | [200/anon 401/norole 403/artist 403](samples/masterdata/vendor-contacts.json) |
| `/api/v1/vendor-contacts/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | VendorContactViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/vendor-contacts/{pk}/restore/` | POST → `restore` | VendorContactViewSet | `restore`: — |  |  |  |
| `/api/v1/vendor-contracts/` | GET → `list`<br>POST → `create` | VendorContractViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `status`, `type`, `vendor`<br>search: contract_number, title<br>ordering: contract_number, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/vendor-contracts.json) |
| `/api/v1/vendor-contracts/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | VendorContractViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/vendor-contracts/{pk}/activate/` | POST → `activate` | VendorContractViewSet | `activate`: — |  |  |  |
| `/api/v1/vendor-contracts/{pk}/adjust-end-date/` | POST → `adjust_end_date` | VendorContractViewSet | `adjust_end_date`: — |  |  |  |
| `/api/v1/vendor-contracts/{pk}/restore/` | POST → `restore` | VendorContractViewSet | `restore`: — |  |  |  |
| `/api/v1/vendor-contracts/{pk}/terminate/` | POST → `terminate` | VendorContractViewSet | `terminate`: — |  |  |  |
| `/api/v1/vendors/` | GET → `list`<br>POST → `create` | VendorViewSet | `list`: auth only<br>`create`: masterdata.directory.manage | StandardPagination | filter: `status`, `specialization`<br>search: name, code, contact_name<br>ordering: name, code, created_at | [200/anon 401/norole 200/artist 200](samples/masterdata/vendors.json) |
| `/api/v1/vendors/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | VendorViewSet | `retrieve`: auth only<br>`update`: masterdata.directory.manage<br>`partial_update`: masterdata.directory.manage<br>`destroy`: masterdata.directory.manage |  |  |  |
| `/api/v1/vendors/{pk}/restore/` | POST → `restore` | VendorViewSet | `restore`: — |  |  |  |

### audit — endpoints (21 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/activity/` | GET → `list` | ActivityCompatViewSet | `list`: audit.view | StandardPagination |  | [200/anon 401/norole 403/artist 403](samples/audit/activity.json) |
| `/api/v1/audit/` | GET → `list` | AuditCompatViewSet | `list`: audit.view | StandardPagination | search: action, target_type, target_id, target_name, description, actor__email, actor__profile__display_name | [200/anon 401/norole 403/artist 403](samples/audit/audit.json) |
| `/api/v1/audit/activities/` | GET → `list` | ActivityViewSet | `list`: audit.view | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/audit/audit__activities.json) |
| `/api/v1/audit/activities/{uuid}/` | GET → `retrieve` | ActivityViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/activity/` | GET → `list` | ActivityCompatViewSet | `list`: audit.view | StandardPagination |  | [200/anon 401/norole 403/artist 403](samples/audit/audit__activity.json) |
| `/api/v1/audit/api-requests/` | GET → `list` | APIRequestViewSet | `list`: audit.view | StandardPagination | search: path, method, user__email, ip_address | [200/anon 401/norole 403/artist 403](samples/audit/audit__api-requests.json) |
| `/api/v1/audit/api-requests/{uuid}/` | GET → `retrieve` | APIRequestViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/audit-logs/` | GET → `list` | AuditLogViewSet | `list`: audit.view | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/audit/audit__audit-logs.json) |
| `/api/v1/audit/audit-logs/{uuid}/` | GET → `retrieve` | AuditLogViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/background-jobs/` | GET → `list` | BackgroundJobViewSet | `list`: audit.view | StandardPagination | search: job_id, job_type, description, worker_id, queue_name | [200/anon 401/norole 403/artist 403](samples/audit/audit__background-jobs.json) |
| `/api/v1/audit/background-jobs/{uuid}/` | GET → `retrieve` | BackgroundJobViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/background-jobs/{uuid}/cancel/` | POST → `cancel` | BackgroundJobViewSet | `cancel`: audit.update |  |  |  |
| `/api/v1/audit/background-jobs/{uuid}/retry/` | POST → `retry` | BackgroundJobViewSet | `retry`: audit.update |  |  |  |
| `/api/v1/audit/change-logs/` | GET → `list` | ChangeLogViewSet | `list`: audit.view | StandardPagination | search: target_type, target_name, description | [200/anon 401/norole 403/artist 403](samples/audit/audit__change-logs.json) |
| `/api/v1/audit/change-logs/{uuid}/` | GET → `retrieve` | ChangeLogViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/error-logs/` | GET → `list` | ErrorLogViewSet | `list`: audit.view | StandardPagination | search: message, error_type, error_code, request_path | [200/anon 401/norole 403/artist 403](samples/audit/audit__error-logs.json) |
| `/api/v1/audit/error-logs/{uuid}/` | GET → `retrieve` | ErrorLogViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/error-logs/{uuid}/resolve/` | POST → `resolve` | ErrorLogViewSet | `resolve`: audit.update |  |  |  |
| `/api/v1/audit/tracks/` | GET → `list`<br>POST → `create` | TrackViewSet | `list`: audit.view<br>`create`: auth only | StandardPagination | search: event_type, event_name, page_url, page_title, session_id | [200/anon 401/norole 403/artist 403](samples/audit/audit__tracks.json) |
| `/api/v1/audit/tracks/{uuid}/` | GET → `retrieve` | TrackViewSet | `retrieve`: audit.view |  |  |  |
| `/api/v1/audit/{uuid}/` | GET → `retrieve` | AuditCompatViewSet | `retrieve`: audit.view |  |  |  |

### settings — endpoints (25 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/settings/categories/` | GET → `list`<br>POST → `create` | SettingCategoryViewSet | `list`: settings.view<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/settings/settings__categories.json) |
| `/api/v1/settings/categories/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SettingCategoryViewSet | `retrieve`: settings.view<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/categories/{pk}/archive/` | POST → `archive` | SettingCategoryViewSet | `archive`: settings.manage |  |  |  |
| `/api/v1/settings/categories/{pk}/restore/` | POST → `restore` | SettingCategoryViewSet | `restore`: settings.manage |  |  |  |
| `/api/v1/settings/definitions/` | GET → `list`<br>POST → `create` | SettingDefinitionViewSet | `list`: settings.view<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/settings/settings__definitions.json) |
| `/api/v1/settings/definitions/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SettingDefinitionViewSet | `retrieve`: settings.view<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/definitions/{pk}/archive/` | POST → `archive` | SettingDefinitionViewSet | `archive`: settings.manage |  |  |  |
| `/api/v1/settings/definitions/{pk}/restore/` | POST → `restore` | SettingDefinitionViewSet | `restore`: settings.manage |  |  |  |
| `/api/v1/settings/feature-flags/` | GET → `list`<br>POST → `create` | FeatureFlagViewSet | `list`: auth only<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 200/artist 200](samples/settings/settings__feature-flags.json) |
| `/api/v1/settings/feature-flags/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | FeatureFlagViewSet | `retrieve`: auth only<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/feature-flags/{pk}/disable/` | POST → `disable` | FeatureFlagViewSet | `disable`: settings.manage |  |  |  |
| `/api/v1/settings/feature-flags/{pk}/enable/` | POST → `enable` | FeatureFlagViewSet | `enable`: settings.manage |  |  |  |
| `/api/v1/settings/feature-flags/{pk}/schedule/` | POST → `schedule` | FeatureFlagViewSet | `schedule`: settings.manage |  |  |  |
| `/api/v1/settings/localizations/` | GET → `list`<br>POST → `create` | LocalizationViewSet | `list`: settings.view<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/settings/settings__localizations.json) |
| `/api/v1/settings/localizations/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | LocalizationViewSet | `retrieve`: settings.view<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/localizations/{pk}/activate/` | POST → `activate` | LocalizationViewSet | `activate`: settings.manage |  |  |  |
| `/api/v1/settings/localizations/{pk}/deactivate/` | POST → `deactivate` | LocalizationViewSet | `deactivate`: settings.manage |  |  |  |
| `/api/v1/settings/system-settings/` | GET → `list`<br>POST → `create` | SystemSettingViewSet | `list`: settings.view<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/settings/settings__system-settings.json) |
| `/api/v1/settings/system-settings/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SystemSettingViewSet | `retrieve`: settings.view<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/system-settings/{pk}/lock/` | POST → `lock` | SystemSettingViewSet | `lock`: settings.manage |  |  |  |
| `/api/v1/settings/system-settings/{pk}/unlock/` | POST → `unlock` | SystemSettingViewSet | `unlock`: settings.manage |  |  |  |
| `/api/v1/settings/themes/` | GET → `list`<br>POST → `create` | ThemeViewSet | `list`: settings.view<br>`create`: settings.manage | none (bare array) |  | [200/anon 401/norole 403/artist 403](samples/settings/settings__themes.json) |
| `/api/v1/settings/themes/{pk}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ThemeViewSet | `retrieve`: settings.view<br>`update`: settings.manage<br>`partial_update`: settings.manage<br>`destroy`: settings.manage |  |  |  |
| `/api/v1/settings/themes/{pk}/activate/` | POST → `activate` | ThemeViewSet | `activate`: settings.manage |  |  |  |
| `/api/v1/settings/themes/{pk}/deactivate/` | POST → `deactivate` | ThemeViewSet | `deactivate`: settings.manage |  |  |  |

### production — endpoints (191 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/organizations/projects/{project_id}/activity` | APIView | ProjectActivityView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/assets` | APIView | _AssetListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/dashboard` | APIView | ProjectDashboardView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/deliveries` | APIView | ProjectDeliveriesView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/editorial` | APIView | ProjectEditorialView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/files` | APIView | ProjectFilesView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/members` | APIView | ProjectMembersView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/notes` | APIView | ProjectNotesView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/pipeline` | APIView | ProjectPipelineView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/resources` | APIView | ProjectResourcesView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/reviews` | APIView | _ReviewListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/schedule` | APIView | ProjectScheduleView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/sequences` | APIView | _SequenceListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/shots` | APIView | _ShotListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/summary` | APIView | ProjectSummaryView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/tasks` | APIView | _TaskListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/organizations/projects/{project_id}/versions` | APIView | _VersionListView | IsAuthenticatedPermission, HasPermission |  |  |  |
| `/api/v1/analytics/departments/` | APIView | AnalyticsDepartmentsView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/production/analytics__departments.json) |
| `/api/v1/analytics/kpis/` | APIView | AnalyticsKpisView | IsAuthenticated |  |  | [200/anon 401/norole 200/artist 200](samples/production/analytics__kpis.json) |
| `/api/v1/assets/` | GET → `list`<br>POST → `create` | AssetViewSet | `list`: asset.view<br>`create`: asset.create | StandardPagination | filter: `category`, `department`, `project`, `project_id`, `status`<br>search: name, code, category, description<br>ordering: name, code, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/assets.json) |
| `/api/v1/assets/archived/` | GET → `archived` | AssetViewSet | `archived`: asset.view |  |  |  |
| `/api/v1/assets/bulk-archive/` | POST → `bulk_archive` | AssetViewSet | `bulk_archive`: asset.delete |  |  |  |
| `/api/v1/assets/bulk-create/` | POST → `bulk_create` | AssetViewSet | `bulk_create`: asset.create |  |  |  |
| `/api/v1/assets/bulk-restore/` | POST → `bulk_restore` | AssetViewSet | `bulk_restore`: asset.update |  |  |  |
| `/api/v1/assets/bulk-update/` | POST → `bulk_update`<br>PATCH → `bulk_update` | AssetViewSet | `bulk_update`: asset.update |  |  |  |
| `/api/v1/assets/check-existence/` | POST → `check_existence` | AssetViewSet | `check_existence`: asset.create |  |  |  |
| `/api/v1/assets/existence-check/` | POST → `existence_check` | AssetViewSet | `existence_check`: asset.create |  |  |  |
| `/api/v1/assets/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | AssetViewSet | `retrieve`: asset.view<br>`update`: asset.update<br>`partial_update`: asset.update<br>`destroy`: asset.delete |  |  |  |
| `/api/v1/assets/{uuid}/archive/` | POST → `archive` | AssetViewSet | `archive`: asset.delete |  |  |  |
| `/api/v1/assets/{uuid}/rename-code/` | POST → `rename_code` | AssetViewSet | `rename_code`: production.code.rename |  |  |  |
| `/api/v1/assets/{uuid}/restore/` | POST → `restore` | AssetViewSet | `restore`: asset.update |  |  |  |
| `/api/v1/assets/{uuid}/shots/` | GET → `shots` | AssetViewSet | `shots`: asset.view + shot.view |  |  |  |
| `/api/v1/automations/audit-logs/` | APIView | AutomationAuditLogsView | IsAuthenticated, HasPermission |  |  | [200/anon 401/norole 403/artist 403](samples/production/automations__audit-logs.json) |
| `/api/v1/automations/rules/` | APIView | AutomationRulesView | IsAuthenticated, HasPermission |  |  | [200/anon 401/norole 403/artist 403](samples/production/automations__rules.json) |
| `/api/v1/automations/rules/{pk}/` | APIView | AutomationRuleDetailView | IsAuthenticated, HasPermission |  |  |  |
| `/api/v1/editorial/tracks/` | GET → `list`<br>POST → `create` | EditorialTrackViewSet | `list`: track.view<br>`create`: track.create | StandardPagination | filter: `project`, `project_id`, `status`, `track_type`<br>search: name, track_type, status, cut_name<br>ordering: track_number, name, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/editorial__tracks.json) |
| `/api/v1/editorial/tracks/archived/` | GET → `archived` | EditorialTrackViewSet | `archived`: track.view |  |  |  |
| `/api/v1/editorial/tracks/check-existence/` | POST → `check_existence` | EditorialTrackViewSet | `check_existence`: — |  |  |  |
| `/api/v1/editorial/tracks/existence-check/` | POST → `existence_check` | EditorialTrackViewSet | `existence_check`: — |  |  |  |
| `/api/v1/editorial/tracks/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | EditorialTrackViewSet | `retrieve`: track.view<br>`update`: track.update<br>`partial_update`: track.update<br>`destroy`: track.delete |  |  |  |
| `/api/v1/editorial/tracks/{uuid}/archive/` | POST → `archive` | EditorialTrackViewSet | `archive`: — |  |  |  |
| `/api/v1/editorial/tracks/{uuid}/restore/` | POST → `restore` | EditorialTrackViewSet | `restore`: track.update |  |  |  |
| `/api/v1/episodes/` | GET → `list`<br>POST → `create` | EpisodeViewSet | `list`: episode.view<br>`create`: episode.create | StandardPagination | filter: `episode_number`, `project`, `project_id`, `season_number`, `status`<br>search: code, name, description<br>ordering: code, name, season_number, episode_number, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/episodes.json) |
| `/api/v1/episodes/archived/` | GET → `archived` | EpisodeViewSet | `archived`: episode.view |  |  |  |
| `/api/v1/episodes/bulk-archive/` | POST → `bulk_archive` | EpisodeViewSet | `bulk_archive`: episode.delete |  |  |  |
| `/api/v1/episodes/bulk-create/` | POST → `bulk_create` | EpisodeViewSet | `bulk_create`: episode.create |  |  |  |
| `/api/v1/episodes/bulk-restore/` | POST → `bulk_restore` | EpisodeViewSet | `bulk_restore`: episode.update |  |  |  |
| `/api/v1/episodes/bulk-update/` | POST → `bulk_update`<br>PATCH → `bulk_update` | EpisodeViewSet | `bulk_update`: episode.update |  |  |  |
| `/api/v1/episodes/check-existence/` | POST → `check_existence` | EpisodeViewSet | `check_existence`: episode.create |  |  |  |
| `/api/v1/episodes/existence-check/` | POST → `existence_check` | EpisodeViewSet | `existence_check`: episode.create |  |  |  |
| `/api/v1/episodes/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | EpisodeViewSet | `retrieve`: episode.view<br>`update`: episode.update<br>`partial_update`: episode.update<br>`destroy`: episode.delete |  |  |  |
| `/api/v1/episodes/{uuid}/archive/` | POST → `archive` | EpisodeViewSet | `archive`: episode.delete |  |  |  |
| `/api/v1/episodes/{uuid}/restore/` | POST → `restore` | EpisodeViewSet | `restore`: episode.update |  |  |  |
| `/api/v1/media/` | GET → `list`<br>POST → `create` | MediaViewSet | `list`: media.view<br>`create`: media.create | none (bare array) | filter: `media_type`, `project`, `entity_type`, `entity_id`<br>search: title, code, file_name, name, file_format, category<br>ordering: created_at | [200/anon 401/norole 403/artist 200](samples/production/media.json) |
| `/api/v1/media/archived/` | GET → `archived` | MediaViewSet | `archived`: media.view |  |  |  |
| `/api/v1/media/check-existence/` | POST → `check_existence` | MediaViewSet | `check_existence`: — |  |  |  |
| `/api/v1/media/existence-check/` | POST → `existence_check` | MediaViewSet | `existence_check`: — |  |  |  |
| `/api/v1/media/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MediaViewSet | `retrieve`: media.view<br>`update`: media.update<br>`partial_update`: media.update<br>`destroy`: media.delete |  |  |  |
| `/api/v1/media/{uuid}/archive/` | POST → `archive` | MediaViewSet | `archive`: — |  |  |  |
| `/api/v1/media/{uuid}/restore/` | POST → `restore` | MediaViewSet | `restore`: media.update |  |  |  |
| `/api/v1/playlists/` | GET → `list`<br>POST → `create` | PlaylistViewSet | `list`: playlist.view<br>`create`: playlist.create | StandardPagination | filter: `status`, `project`, `client_only`<br>search: name, code<br>ordering: name, created_at | [200/anon 401/norole 403/artist 200](samples/production/playlists.json) |
| `/api/v1/playlists/archived/` | GET → `archived` | PlaylistViewSet | `archived`: playlist.view |  |  |  |
| `/api/v1/playlists/check-existence/` | POST → `check_existence` | PlaylistViewSet | `check_existence`: — |  |  |  |
| `/api/v1/playlists/existence-check/` | POST → `existence_check` | PlaylistViewSet | `existence_check`: — |  |  |  |
| `/api/v1/playlists/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | PlaylistViewSet | `retrieve`: playlist.view<br>`update`: playlist.update<br>`partial_update`: playlist.update<br>`destroy`: playlist.delete |  |  |  |
| `/api/v1/playlists/{uuid}/add-entry/` | POST → `add_entry` | PlaylistViewSet | `add_entry`: playlist.update |  |  |  |
| `/api/v1/playlists/{uuid}/archive/` | POST → `archive` | PlaylistViewSet | `archive`: playlist.update |  |  |  |
| `/api/v1/playlists/{uuid}/remove-entry/` | POST → `remove_entry` | PlaylistViewSet | `remove_entry`: playlist.update |  |  |  |
| `/api/v1/playlists/{uuid}/reorder/` | POST → `reorder` | PlaylistViewSet | `reorder`: playlist.update |  |  |  |
| `/api/v1/playlists/{uuid}/restore/` | POST → `restore` | PlaylistViewSet | `restore`: playlist.update |  |  |  |
| `/api/v1/playlists/{uuid}/share/` | POST → `share` | PlaylistViewSet | `share`: playlist.update |  |  |  |
| `/api/v1/projects/` | GET → `list`<br>POST → `create` | ProjectViewSet | `list`: project.view<br>`create`: project.create | StandardPagination | filter: `code`, `name`, `status`, `type`<br>search: name, code, description, client_name<br>ordering: name, code, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/projects.json) |
| `/api/v1/projects/archived/` | GET → `archived` | ProjectViewSet | `archived`: project.view |  |  |  |
| `/api/v1/projects/check-existence/` | POST → `check_existence` | ProjectViewSet | `check_existence`: — |  |  |  |
| `/api/v1/projects/existence-check/` | POST → `existence_check` | ProjectViewSet | `existence_check`: — |  |  |  |
| `/api/v1/projects/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ProjectViewSet | `retrieve`: project.view<br>`update`: project.update<br>`partial_update`: project.update<br>`destroy`: project.delete |  |  |  |
| `/api/v1/projects/{uuid}/archive/` | POST → `archive` | ProjectViewSet | `archive`: — |  |  |  |
| `/api/v1/projects/{uuid}/dashboard/` | GET → `dashboard` | ProjectViewSet | `dashboard`: project.view |  |  |  |
| `/api/v1/projects/{uuid}/restore/` | POST → `restore` | ProjectViewSet | `restore`: project.update |  |  |  |
| `/api/v1/projects/{uuid}/statistics/` | GET → `statistics` | ProjectViewSet | `statistics`: project.view |  |  |  |
| `/api/v1/reviews/` | GET → `list`<br>POST → `create` | ReviewViewSet | `list`: review.view<br>`create`: review.create | StandardPagination | filter: `entity_code`, `entity_type`, `project`, `project_id`, `status`<br>search: title, code, entity_code<br>ordering: title, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/reviews.json) |
| `/api/v1/reviews/archived/` | GET → `archived` | ReviewViewSet | `archived`: review.view |  |  |  |
| `/api/v1/reviews/check-existence/` | POST → `check_existence` | ReviewViewSet | `check_existence`: — |  |  |  |
| `/api/v1/reviews/existence-check/` | POST → `existence_check` | ReviewViewSet | `existence_check`: — |  |  |  |
| `/api/v1/reviews/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ReviewViewSet | `retrieve`: review.view<br>`update`: review.update<br>`partial_update`: review.update<br>`destroy`: review.delete |  |  |  |
| `/api/v1/reviews/{uuid}/annotations/` | POST → `annotations` | ReviewViewSet | `annotations`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/approve/` | POST → `approve` | ReviewViewSet | `approve`: review.approve |  |  |  |
| `/api/v1/reviews/{uuid}/archive/` | POST → `archive` | ReviewViewSet | `archive`: — |  |  |  |
| `/api/v1/reviews/{uuid}/close/` | POST → `close` | ReviewViewSet | `close`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/comments/` | POST → `comments` | ReviewViewSet | `comments`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/comments/{comment_id}/reopen/` | POST → `reopen_comment` | ReviewViewSet | `reopen_comment`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/comments/{comment_id}/resolve/` | POST → `resolve_comment` | ReviewViewSet | `resolve_comment`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/notes/` | POST → `notes` | ReviewViewSet | `notes`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/participant-verdict/` | POST → `participant_verdict` | ReviewViewSet | `participant_verdict`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/participants/` | POST → `participants` | ReviewViewSet | `participants`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/participants/{participant_id}/` | DELETE → `remove_participant` | ReviewViewSet | `remove_participant`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/reject/` | POST → `reject` | ReviewViewSet | `reject`: review.approve |  |  |  |
| `/api/v1/reviews/{uuid}/request-changes/` | POST → `request_changes` | ReviewViewSet | `request_changes`: review.approve |  |  |  |
| `/api/v1/reviews/{uuid}/restore/` | POST → `restore` | ReviewViewSet | `restore`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/start-review/` | POST → `start_review` | ReviewViewSet | `start_review`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/status-history/` | GET → `status_history` | ReviewViewSet | `status_history`: review.view |  |  |  |
| `/api/v1/reviews/{uuid}/submit/` | POST → `submit` | ReviewViewSet | `submit`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/verdict/` | POST → `verdict` | ReviewViewSet | `verdict`: review.approve |  |  |  |
| `/api/v1/reviews/{uuid}/versions/` | POST → `add_version` | ReviewViewSet | `add_version`: review.update |  |  |  |
| `/api/v1/reviews/{uuid}/versions/{version_id}/` | DELETE → `remove_version` | ReviewViewSet | `remove_version`: review.update |  |  |  |
| `/api/v1/sequences/` | GET → `list`<br>POST → `create` | SequenceViewSet | `list`: sequence.view<br>`create`: sequence.create | StandardPagination | filter: `department`, `episode_id`, `project`, `project_id`, `status`<br>search: code, name, description, department, lead_artist_name<br>ordering: code, name, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/sequences.json) |
| `/api/v1/sequences/archived/` | GET → `archived` | SequenceViewSet | `archived`: sequence.view |  |  |  |
| `/api/v1/sequences/bulk-archive/` | POST → `bulk_archive` | SequenceViewSet | `bulk_archive`: sequence.delete |  |  |  |
| `/api/v1/sequences/bulk-create/` | POST → `bulk_create` | SequenceViewSet | `bulk_create`: sequence.create |  |  |  |
| `/api/v1/sequences/bulk-restore/` | POST → `bulk_restore` | SequenceViewSet | `bulk_restore`: sequence.update |  |  |  |
| `/api/v1/sequences/bulk-update/` | POST → `bulk_update`<br>PATCH → `bulk_update` | SequenceViewSet | `bulk_update`: sequence.update |  |  |  |
| `/api/v1/sequences/check-existence/` | POST → `check_existence` | SequenceViewSet | `check_existence`: sequence.create |  |  |  |
| `/api/v1/sequences/existence-check/` | POST → `existence_check` | SequenceViewSet | `existence_check`: sequence.create |  |  |  |
| `/api/v1/sequences/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | SequenceViewSet | `retrieve`: sequence.view<br>`update`: sequence.update<br>`partial_update`: sequence.update<br>`destroy`: sequence.delete |  |  |  |
| `/api/v1/sequences/{uuid}/archive/` | POST → `archive` | SequenceViewSet | `archive`: sequence.delete |  |  |  |
| `/api/v1/sequences/{uuid}/restore/` | POST → `restore` | SequenceViewSet | `restore`: sequence.update |  |  |  |
| `/api/v1/shots/` | GET → `list`<br>POST → `create` | ShotViewSet | `list`: shot.view<br>`create`: shot.create | StandardPagination | filter: `code`, `episode_id`, `project`, `project_id`, `sequence`, `sequence_code`, `sequence_id`, `status`<br>search: code, name, description, sequence__code<br>ordering: code, name, created_at, status | [200/anon 401/norole 403/artist 200](samples/production/shots.json) |
| `/api/v1/shots/archived/` | GET → `archived` | ShotViewSet | `archived`: shot.view |  |  |  |
| `/api/v1/shots/bulk-archive/` | POST → `bulk_archive` | ShotViewSet | `bulk_archive`: shot.delete |  |  |  |
| `/api/v1/shots/bulk-create/` | POST → `bulk_create` | ShotViewSet | `bulk_create`: shot.create |  |  |  |
| `/api/v1/shots/bulk-restore/` | POST → `bulk_restore` | ShotViewSet | `bulk_restore`: shot.update |  |  |  |
| `/api/v1/shots/bulk-update/` | POST → `bulk_update`<br>PATCH → `bulk_update` | ShotViewSet | `bulk_update`: shot.update |  |  |  |
| `/api/v1/shots/check-existence/` | POST → `check_existence` | ShotViewSet | `check_existence`: shot.create |  |  |  |
| `/api/v1/shots/existence-check/` | POST → `existence_check` | ShotViewSet | `existence_check`: shot.create |  |  |  |
| `/api/v1/shots/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ShotViewSet | `retrieve`: shot.view<br>`update`: shot.update<br>`partial_update`: shot.update<br>`destroy`: shot.delete |  |  |  |
| `/api/v1/shots/{uuid}/approve/` | POST → `approve` | ShotViewSet | `approve`: shot.approve |  |  |  |
| `/api/v1/shots/{uuid}/archive/` | POST → `archive` | ShotViewSet | `archive`: shot.delete |  |  |  |
| `/api/v1/shots/{uuid}/assets/` | GET → `assets`<br>POST → `link_asset` | ShotViewSet | `assets`: shot.view + asset.view<br>`link_asset`: shot.update + asset.view |  |  |  |
| `/api/v1/shots/{uuid}/assets/{asset_ref}/` | PATCH → `update_asset_link`<br>DELETE → `unlink_asset` | ShotViewSet | `update_asset_link`: shot.update<br>`unlink_asset`: shot.update |  |  |  |
| `/api/v1/shots/{uuid}/rename-code/` | POST → `rename_code` | ShotViewSet | `rename_code`: production.code.rename |  |  |  |
| `/api/v1/shots/{uuid}/restore/` | POST → `restore` | ShotViewSet | `restore`: shot.update |  |  |  |
| `/api/v1/shots/{uuid}/status-history/` | GET → `status_history` | ShotViewSet | `status_history`: shot.view |  |  |  |
| `/api/v1/shows/` | GET → `list`<br>POST → `create` | ShowViewSet | `list`: show.view<br>`create`: show.create | StandardPagination | filter: `is_primary`, `project`, `project_id`, `status`<br>search: name, code, description<br>ordering: code, name, created_at | [200/anon 401/norole 403/artist 200](samples/production/shows.json) |
| `/api/v1/shows/archived/` | GET → `archived` | ShowViewSet | `archived`: show.view |  |  |  |
| `/api/v1/shows/check-existence/` | POST → `check_existence` | ShowViewSet | `check_existence`: — |  |  |  |
| `/api/v1/shows/existence-check/` | POST → `existence_check` | ShowViewSet | `existence_check`: — |  |  |  |
| `/api/v1/shows/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ShowViewSet | `retrieve`: show.view<br>`update`: show.update<br>`partial_update`: show.update<br>`destroy`: show.delete |  |  |  |
| `/api/v1/shows/{uuid}/archive/` | POST → `archive` | ShowViewSet | `archive`: — |  |  |  |
| `/api/v1/shows/{uuid}/restore/` | POST → `restore` | ShowViewSet | `restore`: show.update |  |  |  |
| `/api/v1/task-templates/` | GET → `list`<br>POST → `create` | TaskTemplateViewSet | `list`: tasktemplate.view<br>`create`: tasktemplate.create | StandardPagination | filter: `entity_type`, `is_active`, `project_id`, `studio`<br>search: name, description<br>ordering: name, created_at | [200/anon 401/norole 403/artist 200](samples/production/task-templates.json) |
| `/api/v1/task-templates/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TaskTemplateViewSet | `retrieve`: tasktemplate.view<br>`update`: tasktemplate.update<br>`partial_update`: tasktemplate.update<br>`destroy`: tasktemplate.delete |  |  |  |
| `/api/v1/task-templates/{uuid}/apply/` | POST → `apply` | TaskTemplateViewSet | `apply`: tasktemplate.view + task.create |  |  |  |
| `/api/v1/task-templates/{uuid}/copy-to-project/` | POST → `copy_to_project` | TaskTemplateViewSet | `copy_to_project`: tasktemplate.create |  |  |  |
| `/api/v1/tasks/` | GET → `list`<br>POST → `create` | TaskViewSet | `list`: task.view<br>`create`: task.create | StandardPagination | filter: `asset_id`, `assignee`, `assignee_id`, `department`, `entity_id`, `entity_type`, `is_archived`, `priority`, `project`, `project_id`, `sequence_id`, `shot_id`, `show_id`, `status`, `team`, `team_id`, `vendor_id`<br>search: title, code, description<br>ordering: title, code, created_at, status, priority, due_date | [200/anon 401/norole 403/artist 200](samples/production/tasks.json) |
| `/api/v1/tasks/archived/` | GET → `archived` | TaskViewSet | `archived`: task.view |  |  |  |
| `/api/v1/tasks/bulk-archive/` | POST → `bulk_archive` | TaskViewSet | `bulk_archive`: task.update |  |  |  |
| `/api/v1/tasks/bulk-assign/` | POST → `bulk_assign` | TaskViewSet | `bulk_assign`: task.update |  |  |  |
| `/api/v1/tasks/bulk-create/` | POST → `bulk_create` | TaskViewSet | `bulk_create`: task.create |  |  |  |
| `/api/v1/tasks/bulk-delete/` | POST → `bulk_delete` | TaskViewSet | `bulk_delete`: task.delete |  |  |  |
| `/api/v1/tasks/bulk-restore/` | POST → `bulk_restore` | TaskViewSet | `bulk_restore`: task.update |  |  |  |
| `/api/v1/tasks/bulk-status/` | POST → `bulk_status` | TaskViewSet | `bulk_status`: task.update |  |  |  |
| `/api/v1/tasks/bulk-update/` | POST → `bulk_update`<br>PATCH → `bulk_update` | TaskViewSet | `bulk_update`: task.update |  |  |  |
| `/api/v1/tasks/check-existence/` | POST → `check_existence` | TaskViewSet | `check_existence`: task.create |  |  |  |
| `/api/v1/tasks/existence-check/` | POST → `existence_check` | TaskViewSet | `existence_check`: task.create |  |  |  |
| `/api/v1/tasks/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TaskViewSet | `retrieve`: task.view<br>`update`: task.update<br>`partial_update`: task.update<br>`destroy`: task.delete |  |  |  |
| `/api/v1/tasks/{uuid}/archive/` | POST → `archive` | TaskViewSet | `archive`: task.update |  |  |  |
| `/api/v1/tasks/{uuid}/restore/` | POST → `restore` | TaskViewSet | `restore`: task.update |  |  |  |
| `/api/v1/tasks/{uuid}/status-history/` | GET → `status_history` | TaskViewSet | `status_history`: task.view |  |  |  |
| `/api/v1/timelogs/` | GET → `list`<br>POST → `create` | TimelogViewSet | `list`: timelog.view<br>`create`: timelog.create | StandardPagination | filter: `billable`, `date`, `end_date`, `person`, `project`, `project_id`, `start_date`, `status`, `task`<br>search: notes<br>ordering: date, created_at, duration_hours | [200/anon 401/norole 403/artist 200](samples/production/timelogs.json) |
| `/api/v1/timelogs/archived/` | GET → `archived` | TimelogViewSet | `archived`: timelog.view |  |  |  |
| `/api/v1/timelogs/check-existence/` | POST → `check_existence` | TimelogViewSet | `check_existence`: — |  |  |  |
| `/api/v1/timelogs/existence-check/` | POST → `existence_check` | TimelogViewSet | `existence_check`: — |  |  |  |
| `/api/v1/timelogs/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | TimelogViewSet | `retrieve`: timelog.view<br>`update`: timelog.update<br>`partial_update`: timelog.update<br>`destroy`: timelog.delete |  |  |  |
| `/api/v1/timelogs/{uuid}/approve/` | POST → `approve` | TimelogViewSet | `approve`: timelog.approve |  |  |  |
| `/api/v1/timelogs/{uuid}/archive/` | POST → `archive` | TimelogViewSet | `archive`: — |  |  |  |
| `/api/v1/timelogs/{uuid}/reject/` | POST → `reject` | TimelogViewSet | `reject`: timelog.approve |  |  |  |
| `/api/v1/timelogs/{uuid}/restore/` | POST → `restore` | TimelogViewSet | `restore`: timelog.update |  |  |  |
| `/api/v1/timelogs/{uuid}/status-history/` | GET → `status_history` | TimelogViewSet | `status_history`: timelog.view |  |  |  |
| `/api/v1/versions/` | GET → `list`<br>POST → `create` | VersionViewSet | `list`: version.view<br>`create`: version.create | StandardPagination | filter: `department`, `entity_id`, `entity_type`, `is_archived`, `is_published`, `project`, `project_id`, `status`<br>search: code, version_number, entity_code<br>ordering: code, created_at, version_number | [200/anon 401/norole 403/artist 200](samples/production/versions.json) |
| `/api/v1/versions/archived/` | GET → `archived` | VersionViewSet | `archived`: version.view |  |  |  |
| `/api/v1/versions/check-existence/` | POST → `check_existence` | VersionViewSet | `check_existence`: — |  |  |  |
| `/api/v1/versions/existence-check/` | POST → `existence_check` | VersionViewSet | `existence_check`: — |  |  |  |
| `/api/v1/versions/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | VersionViewSet | `retrieve`: version.view<br>`update`: version.update<br>`partial_update`: version.update<br>`destroy`: version.delete |  |  |  |
| `/api/v1/versions/{uuid}/add-to-playlist/` | POST → `add_to_playlist` | VersionViewSet | `add_to_playlist`: version.update + playlist.update |  |  |  |
| `/api/v1/versions/{uuid}/archive/` | POST → `archive` | VersionViewSet | `archive`: version.update |  |  |  |
| `/api/v1/versions/{uuid}/promote/` | POST → `promote` | VersionViewSet | `promote`: version.publish |  |  |  |
| `/api/v1/versions/{uuid}/publish/` | POST → `publish` | VersionViewSet | `publish`: version.publish |  |  |  |
| `/api/v1/versions/{uuid}/restore/` | POST → `restore` | VersionViewSet | `restore`: version.update |  |  |  |
| `/api/v1/versions/{uuid}/status-history/` | GET → `status_history` | VersionViewSet | `status_history`: version.view |  |  |  |
| `/api/v1/versions/{uuid}/unpublish/` | POST → `unpublish` | VersionViewSet | `unpublish`: version.publish |  |  |  |
| `/api/v1/workflows/` | GET → `list`<br>POST → `create` | WorkflowViewSet | `list`: workflow.view<br>`create`: workflow.create | StandardPagination | filter: `category`, `department`, `event_type`, `is_active`, `project`, `project_id`<br>search: name, code, description<br>ordering: name, created_at | [200/anon 401/norole 403/artist 200](samples/production/workflows.json) |
| `/api/v1/workflows/archived/` | GET → `archived` | WorkflowViewSet | `archived`: workflow.view |  |  |  |
| `/api/v1/workflows/check-existence/` | POST → `check_existence` | WorkflowViewSet | `check_existence`: — |  |  |  |
| `/api/v1/workflows/existence-check/` | POST → `existence_check` | WorkflowViewSet | `existence_check`: — |  |  |  |
| `/api/v1/workflows/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | WorkflowViewSet | `retrieve`: workflow.view<br>`update`: workflow.update<br>`partial_update`: workflow.update<br>`destroy`: workflow.delete |  |  |  |
| `/api/v1/workflows/{uuid}/activate/` | POST → `activate` | WorkflowViewSet | `activate`: workflow.update |  |  |  |
| `/api/v1/workflows/{uuid}/archive/` | POST → `archive` | WorkflowViewSet | `archive`: workflow.delete |  |  |  |
| `/api/v1/workflows/{uuid}/clone/` | POST → `clone` | WorkflowViewSet | `clone`: workflow.create |  |  |  |
| `/api/v1/workflows/{uuid}/deactivate/` | POST → `deactivate` | WorkflowViewSet | `deactivate`: workflow.update |  |  |  |
| `/api/v1/workflows/{uuid}/restore/` | POST → `restore` | WorkflowViewSet | `restore`: workflow.update |  |  |  |
| `/api/v1/workflows/{uuid}/simulate/` | POST → `simulate` | WorkflowViewSet | `simulate`: workflow.view |  |  |  |

### deliveries — endpoints (21 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/deliveries/` | GET → `list`<br>POST → `create` | DeliveryViewSet | `list`: delivery.view<br>`create`: delivery.create | StandardPagination | search: name, code, client__name<br>ordering: name, created_at, status | [200/anon 401/norole 403/artist 200](samples/deliveries/deliveries.json) |
| `/api/v1/deliveries/bulk-cancel/` | POST → `bulk_cancel` | DeliveryViewSet | `bulk_cancel`: delivery.update |  |  |  |
| `/api/v1/deliveries/destinations/` | GET → `list`<br>POST → `create` | DestinationViewSet | `list`: delivery.view<br>`create`: delivery.create | StandardPagination | search: name, endpoint, storage_region<br>ordering: name, created_at | [200/anon 401/norole 403/artist 200](samples/deliveries/deliveries__destinations.json) |
| `/api/v1/deliveries/destinations/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | DestinationViewSet | `retrieve`: delivery.view<br>`update`: delivery.update<br>`partial_update`: delivery.update<br>`destroy`: delivery.delete |  |  |  |
| `/api/v1/deliveries/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | DeliveryViewSet | `retrieve`: delivery.view<br>`update`: delivery.update<br>`partial_update`: delivery.update<br>`destroy`: delivery.delete |  |  |  |
| `/api/v1/deliveries/{uuid}/add-version/` | POST → `add_version` | DeliveryViewSet | `add_version`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/approve/` | POST → `approve` | DeliveryViewSet | `approve`: delivery.send |  |  |  |
| `/api/v1/deliveries/{uuid}/cancel/` | POST → `cancel` | DeliveryViewSet | `cancel`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/complete/` | POST → `complete` | DeliveryViewSet | `complete`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/history/` | GET → `history` | DeliveryViewSet | `history`: delivery.view |  |  |  |
| `/api/v1/deliveries/{uuid}/passcode/` | GET → `passcode` | DeliveryViewSet | `passcode`: delivery.view_secret |  |  |  |
| `/api/v1/deliveries/{uuid}/prepare/` | POST → `prepare` | DeliveryViewSet | `prepare`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/qc/` | GET → `qc` | DeliveryViewSet | `qc`: delivery.view |  |  |  |
| `/api/v1/deliveries/{uuid}/reject/` | POST → `reject` | DeliveryViewSet | `reject`: delivery.send |  |  |  |
| `/api/v1/deliveries/{uuid}/remove-version/` | POST → `remove_version` | DeliveryViewSet | `remove_version`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/reopen/` | POST → `reopen` | DeliveryViewSet | `reopen`: delivery.approve |  |  |  |
| `/api/v1/deliveries/{uuid}/retry/` | POST → `retry` | DeliveryViewSet | `retry`: delivery.update |  |  |  |
| `/api/v1/deliveries/{uuid}/revise/` | POST → `revise` | DeliveryViewSet | `revise`: delivery.send |  |  |  |
| `/api/v1/deliveries/{uuid}/sign-off/` | POST → `sign_off` | DeliveryViewSet | `sign_off`: delivery.approve |  |  |  |
| `/api/v1/deliveries/{uuid}/submit/` | POST → `submit` | DeliveryViewSet | `submit`: delivery.send |  |  |  |
| `/api/v1/deliveries/{uuid}/validate/` | POST → `validate` | DeliveryViewSet | `validate`: delivery.update |  |  |  |

### publishing — endpoints (19 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/publishing/` | GET → `list`<br>POST → `create` | PublishingViewSet | `list`: publishing.view<br>`create`: publishing.create | StandardPagination | search: name, code, entity_code, entity_name<br>ordering: name, created_at, status | [200/anon 401/norole 403/artist 200](samples/publishing/publishing.json) |
| `/api/v1/publishing/destinations/` | GET → `list`<br>POST → `create` | DestinationViewSet | `list`: publishing.view<br>`create`: publishing.create | StandardPagination | search: name, path, region<br>ordering: name, created_at | [200/anon 401/norole 403/artist 200](samples/publishing/publishing__destinations.json) |
| `/api/v1/publishing/destinations/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | DestinationViewSet | `retrieve`: publishing.view<br>`update`: publishing.update<br>`partial_update`: publishing.update<br>`destroy`: publishing.delete |  |  |  |
| `/api/v1/publishing/files/` | GET → `list`<br>POST → `create` | PublishedFileViewSet | `list`: publishing.view<br>`create`: publishing.create | StandardPagination | ordering: created_at, relative_path, status | [200/anon 401/norole 403/artist 200](samples/publishing/publishing__files.json) |
| `/api/v1/publishing/files/bulk-register/` | POST → `bulk_register` | PublishedFileViewSet | `bulk_register`: publishing.create |  |  |  |
| `/api/v1/publishing/files/{uuid}/` | GET → `retrieve` | PublishedFileViewSet | `retrieve`: publishing.view |  |  |  |
| `/api/v1/publishing/files/{uuid}/deprecate/` | POST → `deprecate` | PublishedFileViewSet | `deprecate`: publishing.deprecate |  |  |  |
| `/api/v1/publishing/files/{uuid}/restore/` | POST → `restore` | PublishedFileViewSet | `restore`: publishing.deprecate |  |  |  |
| `/api/v1/publishing/files/{uuid}/revoke/` | POST → `revoke` | PublishedFileViewSet | `revoke`: publishing.revoke |  |  |  |
| `/api/v1/publishing/storage-roots/` | GET → `list`<br>POST → `create` | StorageRootViewSet | `list`: publishing.view<br>`create`: publishing.storage.manage | StandardPagination |  | [200/anon 401/norole 403/artist 200](samples/publishing/publishing__storage-roots.json) |
| `/api/v1/publishing/storage-roots/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | StorageRootViewSet | `retrieve`: publishing.view<br>`update`: publishing.storage.manage<br>`partial_update`: publishing.storage.manage<br>`destroy`: publishing.storage.manage |  |  |  |
| `/api/v1/publishing/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | PublishingViewSet | `retrieve`: publishing.view<br>`update`: publishing.update<br>`partial_update`: publishing.update<br>`destroy`: publishing.delete |  |  |  |
| `/api/v1/publishing/{uuid}/complete-export/` | POST → `complete_export` | PublishingViewSet | `complete_export`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/fail/` | POST → `fail` | PublishingViewSet | `fail`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/republish/` | POST → `republish` | PublishingViewSet | `republish`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/retry/` | POST → `retry` | PublishingViewSet | `retry`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/start-export/` | POST → `start_export` | PublishingViewSet | `start_export`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/unpublish/` | POST → `unpublish` | PublishingViewSet | `unpublish`: publishing.update |  |  |  |
| `/api/v1/publishing/{uuid}/validate/` | POST → `validate` | PublishingViewSet | `validate`: publishing.update |  |  |  |

### scheduling — endpoints (26 paths)

| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |
|---|---|---|---|---|---|---|
| `/api/v1/scheduling/calendars/` | GET → `list`<br>POST → `create` | WorkCalendarViewSet | `list`: schedule.view<br>`create`: schedule.manage | none (bare array) | search: code, name<br>ordering: name, code, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__calendars.json) |
| `/api/v1/scheduling/calendars/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | WorkCalendarViewSet | `retrieve`: schedule.view<br>`update`: schedule.manage<br>`partial_update`: schedule.manage<br>`destroy`: schedule.manage |  |  |  |
| `/api/v1/scheduling/calendars/{uuid}/set-default/` | POST → `set_default` | WorkCalendarViewSet | `set_default`: schedule.manage |  |  |  |
| `/api/v1/scheduling/capacity/` | APIView | SchedulingCapacityView | IsAuthenticated, HasPermission |  |  | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__capacity.json) |
| `/api/v1/scheduling/events/` | GET → `list`<br>POST → `create` | CalendarEventViewSet | `list`: schedule.view<br>`create`: schedule.create | none (bare array) | search: title, description, location<br>ordering: start_time, end_time, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__events.json) |
| `/api/v1/scheduling/events/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | CalendarEventViewSet | `retrieve`: schedule.view<br>`update`: schedule.update<br>`partial_update`: schedule.update<br>`destroy`: schedule.delete |  |  |  |
| `/api/v1/scheduling/events/{uuid}/update-status/` | POST → `update_status` | CalendarEventViewSet | `update_status`: schedule.update |  |  |  |
| `/api/v1/scheduling/holidays/` | GET → `list`<br>POST → `create` | HolidayViewSet | `list`: schedule.view<br>`create`: schedule.manage | none (bare array) | search: name, description<br>ordering: holiday_date, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__holidays.json) |
| `/api/v1/scheduling/holidays/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | HolidayViewSet | `retrieve`: schedule.view<br>`update`: schedule.manage<br>`partial_update`: schedule.manage<br>`destroy`: schedule.manage |  |  |  |
| `/api/v1/scheduling/leaves/` | GET → `list`<br>POST → `create` | ResourceLeaveViewSet | `list`: schedule.view<br>`create`: schedule.create | none (bare array) | search: resource__name, resource__code<br>ordering: start_date, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__leaves.json) |
| `/api/v1/scheduling/leaves/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ResourceLeaveViewSet | `retrieve`: schedule.view<br>`update`: schedule.create<br>`partial_update`: schedule.create<br>`destroy`: schedule.delete |  |  |  |
| `/api/v1/scheduling/leaves/{uuid}/approve/` | POST → `approve` | ResourceLeaveViewSet | `approve`: schedule.approve |  |  |  |
| `/api/v1/scheduling/leaves/{uuid}/reject/` | POST → `reject` | ResourceLeaveViewSet | `reject`: schedule.approve |  |  |  |
| `/api/v1/scheduling/milestones/` | GET → `list`<br>POST → `create` | MilestoneViewSet | `list`: schedule.view<br>`create`: schedule.manage | none (bare array) | search: name<br>ordering: due_date, order, name, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__milestones.json) |
| `/api/v1/scheduling/milestones/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | MilestoneViewSet | `retrieve`: schedule.view<br>`update`: schedule.manage<br>`partial_update`: schedule.manage<br>`destroy`: schedule.manage |  |  |  |
| `/api/v1/scheduling/milestones/{uuid}/complete/` | POST → `complete` | MilestoneViewSet | `complete`: schedule.manage |  |  |  |
| `/api/v1/scheduling/milestones/{uuid}/reopen/` | POST → `reopen` | MilestoneViewSet | `reopen`: schedule.manage |  |  |  |
| `/api/v1/scheduling/overbooking/` | APIView | SchedulingOverbookingView | IsAuthenticated, HasPermission |  |  | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__overbooking.json) |
| `/api/v1/scheduling/resolve-overbooking/` | APIView | SchedulingResolveOverbookingView | IsAuthenticated, HasPermission |  |  | [403/anon 401/norole 403/artist 403](samples/scheduling/scheduling__resolve-overbooking.json) |
| `/api/v1/scheduling/resources/` | GET → `list`<br>POST → `create` | ResourceViewSet | `list`: schedule.view<br>`create`: schedule.manage | none (bare array) | search: name, code, location<br>ordering: name, capacity_hours_per_week, hourly_rate_usd | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__resources.json) |
| `/api/v1/scheduling/resources/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ResourceViewSet | `retrieve`: schedule.view<br>`update`: schedule.update<br>`partial_update`: schedule.update<br>`destroy`: schedule.delete |  |  |  |
| `/api/v1/scheduling/resources/{uuid}/block/` | POST → `block` | ResourceViewSet | `block`: schedule.manage |  |  |  |
| `/api/v1/scheduling/resources/{uuid}/book/` | POST → `book` | ResourceViewSet | `book`: schedule.manage |  |  |  |
| `/api/v1/scheduling/schedules/` | GET → `list`<br>POST → `create` | ResourceScheduleViewSet | `list`: schedule.view<br>`create`: schedule.manage | none (bare array) | search: resource__name, resource__code<br>ordering: start_time, end_time, created_at | [200/anon 401/norole 403/artist 200](samples/scheduling/scheduling__schedules.json) |
| `/api/v1/scheduling/schedules/bulk-delete/` | POST → `bulk_delete` | ResourceScheduleViewSet | `bulk_delete`: schedule.delete |  |  |  |
| `/api/v1/scheduling/schedules/{uuid}/` | GET → `retrieve`<br>PUT → `update`<br>PATCH → `partial_update`<br>DELETE → `destroy` | ResourceScheduleViewSet | `retrieve`: schedule.view<br>`update`: schedule.manage<br>`partial_update`: schedule.manage<br>`destroy`: schedule.delete |  |  |  |

## Models (generated)

Base columns (`id` UUID pk, `created_at`, `updated_at`, `created_by`, `updated_by`, `is_deleted`, `deleted_at`, `deleted_by`, `metadata`) are omitted per model. `!u` = unique. Relations show `->target(on_delete)`.


### core models (2)

#### core.Attachment (soft-delete)
- fields: file:File, name:Char(255), description:Text, file_type:Char(20), mime_type:Char(100), file_size:PositiveBigInteger, storage_key:Char(500)!u, is_public:Boolean, expires_at:DateTime
- relations: —
- choices: file_type=[image,video,audio,document,cache,script]

#### core.Tag (soft-delete)
- fields: name:Char(100)!u, description:Text, color:Char(20), is_system:Boolean
- relations: —


### identity models (21)

#### identity.ApiKey (soft-delete) lifecycle:is_active
- fields: name:Char(255), description:Text, prefix:Char(16), hashed_key:Char(255)!u, scopes:JSON, expires_at:DateTime, last_used_at:DateTime, last_used_ip:GenericIPAddress, revoked_at:DateTime, is_active:Boolean
- relations: owner->identity.User(SET_NULL)

#### identity.BackupCode (soft-delete)
- fields: code_hash:Char(255), used:Boolean, used_at:DateTime, expires_at:DateTime
- relations: user->identity.User(CASCADE)

#### identity.Group (soft-delete)
- fields: color:Char(32), code:Char(100)!u, name:Char(255), description:Text, is_system:Boolean
- relations: users->identity.User[M2M]

#### identity.GroupMember (soft-delete)
- fields: is_owner:Boolean, is_manager:Boolean, joined_at:DateTime, left_at:DateTime
- relations: group->identity.Group(CASCADE), user->identity.User(CASCADE)

#### identity.GroupRole (soft-delete)
- fields: 
- relations: group->identity.Group(CASCADE), role->identity.Role(CASCADE)

#### identity.IPBlacklist (soft-delete) lifecycle:is_active
- fields: ip_address:GenericIPAddress, network:Char(50), description:Text, reason:Char(255), is_active:Boolean, expires_at:DateTime, last_hit_at:DateTime, hit_count:PositiveInteger
- relations: blocked_by->identity.User(SET_NULL)

#### identity.LoginAttempt (soft-delete)
- fields: username:Char(255), ip_address:GenericIPAddress, user_agent:Text, success:Boolean, reason:Char(255), attempted_at:DateTime, locked_until:DateTime
- relations: user->identity.User(SET_NULL)
- choices: reason=[unknown_user,invalid_password,user_inactive,user_deleted,user_locked,too_many_attempts]

#### identity.LoginHistory (soft-delete) lifecycle:status
- fields: login_type:Char(50), login_method:Char(30), status:Char(20), ip_address:GenericIPAddress, user_agent:Text, location:Char(255), mfa_enabled:Boolean, mfa_type:Char(50), session_id:Char(100), device_name:Char(255), device_type:Char(50), browser:Char(255), browser_version:Char(50), operating_system:Char(100), failure_reason:Text
- relations: user->identity.User(CASCADE)
- choices: login_type=[login,logout,password_change,password_reset,mfa_verify,device_login]; status=[success,failed,expired,revoked]

#### identity.PasswordHistory
- fields: password_hash:Char(256)
- relations: user->identity.User(CASCADE)

#### identity.PasswordResetToken (soft-delete)
- fields: token_hash:Char(64)!u, expires_at:DateTime, used_at:DateTime, requested_ip:GenericIPAddress
- relations: user->identity.User(CASCADE)

#### identity.Permission (soft-delete) lifecycle:is_active
- fields: name:Char(150), code:Char(150)!u, module:Char(50), action:Char(50), category:Char(50), description:Text, is_system:Boolean, is_active:Boolean, sort_order:PositiveInteger
- relations: —
- choices: module=[organization,department,team,office,user,role,permission,group,branding,holiday,calendar,work_hours,position,membership,api_key,personal_access_token]; action=[view,create,update,delete,manage,assign,approve,reject,publish,archive,restore,activate,deactivate,export,import]; category=[general,settings,content,users,roles,permissions,groups,branding,holidays,calendars,work_hours,positions,memberships,api_keys,access_tokens]

#### identity.PersonalAccessToken (soft-delete) lifecycle:is_active
- fields: name:Char(255), prefix:Char(16), hashed_token:Char(255)!u, scopes:JSON, expires_at:DateTime, last_used_at:DateTime, last_used_ip:GenericIPAddress, revoked_at:DateTime, is_active:Boolean
- relations: user->identity.User(CASCADE)

#### identity.Profile (soft-delete)
- fields: first_name:Char(100), last_name:Char(100), display_name:Char(255), avatar:File, avatar_url:Char(500), phone:Char(30), bio:Text, timezone:Char(64), language:Char(10), preferences:JSON, must_change_password:Boolean
- relations: user->identity.User(CASCADE)
- choices: timezone=[Africa/Abidjan,Africa/Accra,Africa/Addis_Ababa,Africa/Algiers,Africa/Asmara,Africa/Asmera,Africa/Bamako,Africa/Bangui,Africa/Banjul,Africa/Bissau,Africa/Blantyr]; language=[en,hi,ja,zh,ko]

#### identity.Role (soft-delete) lifecycle:is_active
- fields: color:Char(32), name:Char(150), code:Slug(100)!u, description:Text, role_type:Char(30), scope:Char(30), priority:PositiveSmallInteger, icon:Char(50), is_system:Boolean, is_default:Boolean, is_active:Boolean, sort_order:PositiveInteger
- relations: parent->identity.Role(SET_NULL)
- choices: role_type=[organization,department,team,office]; scope=[organization,project,show,department,team,office]; priority=[10,20,30,40,50,60]

#### identity.RolePermission (soft-delete)
- fields: granted:Boolean, granted_at:DateTime, expires_at:DateTime
- relations: role->identity.Role(CASCADE), permission->identity.Permission(CASCADE), granted_by->identity.User(SET_NULL)

#### identity.SecurityEvent (soft-delete)
- fields: event_type:Char(50), ip_address:GenericIPAddress, user_agent:Text, description:Text, is_critical:Boolean, occurred_at:DateTime
- relations: user->identity.User(SET_NULL)
- choices: event_type=[login_success,login_failed,login_locked,password_changed,password_reset,email_verified,mfa_enabled,mfa_disabled,mfa_verified,mfa_failed,mfa_locked,mfa_recovery_]

#### identity.TrustedDevice (soft-delete)
- fields: fingerprint:Char(255), browser:Char(100), platform:Char(100), ip_address:GenericIPAddress, user_agent:Text, last_login_at:DateTime, expires_at:DateTime, is_trusted:Boolean, revoked_at:DateTime
- relations: user->identity.User(CASCADE)

#### identity.User (soft-delete) lifecycle:is_active
- fields: password:Char(128), last_login:DateTime, is_superuser:Boolean, email:Char(254)!u, is_active:Boolean, is_staff:Boolean, is_email_verified:Boolean, last_seen:DateTime
- relations: identity_groups->identity.Group[M2M], groups->auth.Group[M2M], user_permissions->auth.Permission[M2M]

#### identity.UserMFA (soft-delete) lifecycle:status
- fields: totp_secret:Char(255), primary_method:Char(32), status:Char(32), email_enabled:Boolean, sms_enabled:Boolean, recovery_enabled:Boolean, is_verified:Boolean, last_used_at:DateTime, failed_attempts:PositiveInteger, locked_until:DateTime, totp_confirmed_at:DateTime, last_used_step:BigInteger, last_verified_ip:GenericIPAddress, last_verified_user_agent:Text
- relations: user->identity.User(CASCADE)
- choices: primary_method=[totp,email,sms,recovery]; status=[pending,enabled,disabled,locked]

#### identity.UserRole (soft-delete)
- fields: 
- relations: user->identity.User(CASCADE), role->identity.Role(CASCADE)

#### identity.UserSession (soft-delete) lifecycle:status
- fields: session_key:Char(255)!u, access_token_jti:Char(255), refresh_token_jti:Char(255), authentication_method:Char(30), status:Char(20), device_type:Char(30), browser:Char(50), browser_version:Char(30), operating_system:Char(50), operating_system_version:Char(30), device_name:Char(255), device_id:Char(255), ip_address:GenericIPAddress, user_agent:Text, country:Char(100), country_code:Char(10), region:Char(100), city:Char(100), latitude:Decimal, longitude:Decimal, started_at:DateTime, last_activity:DateTime, expires_at:DateTime, logged_out_at:DateTime, logout_reason:Char(30), is_trusted:Boolean, is_current:Boolean
- relations: user->identity.User(CASCADE)
- choices: authentication_method=[PASSWORD,OTP,MFA,GOOGLE,MICROSOFT,LDAP,API_KEY,SSO]; status=[ACTIVE,EXPIRED,LOGGED_OUT,REVOKED,LOCKED]; device_type=[DESKTOP,LAPTOP,MOBILE,TABLET,TV,BOT,UNKNOWN]; browser=[CHROME,FIREFOX,EDGE,SAFARI,OPERA,BRAVE,UNKNOWN]; operating_system=[WINDOWS,MACOS,LINUX,IOS,ANDROID,UNKNOWN]; logout_reason=[USER,ADMIN,TOKEN_EXPIRED,REVOKED,PASSWORD_CHANGED,ACCOUNT_DISABLED,ACCOUNT_LOCKED,SESSION_EXPIRED,SECURITY_POLICY,SESSION_LIMIT,USER_LOGOUT,UNKNOWN]


### masterdata models (19)

#### masterdata.Software (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, publisher:Char(255), category:Char(100), website:Char(200)
- relations: —
- choices: status=[active,archived]

#### masterdata.SoftwareVersion (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, version:Char(50), version_code:Char(100), release_date:Date, end_of_support:Date, version_key:Char(120)
- relations: software->masterdata.Software(PROTECT)
- choices: status=[active,archived]

#### masterdata.MasterStatus (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, entity_type:Char(50), category:Char(50), color:Char(20), order:PositiveInteger, is_default:Boolean, is_final:Boolean
- relations: —
- choices: status=[active,archived]; entity_type=[Project,Sequence,Shot,Asset,Task,Version,Review,Delivery]; category=[not_started,in_progress,review,done,cancelled]

#### masterdata.MasterTaskType (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, category:Char(50), department_code:Char(50), department_name:Char(255), color:Char(20), icon:Char(100)
- relations: —
- choices: status=[active,archived]

#### masterdata.MasterAssetType (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, color:Char(20), icon:Char(100)
- relations: —
- choices: status=[active,archived]

#### masterdata.MasterShotType (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, default_handle_frames:PositiveInteger
- relations: —
- choices: status=[active,archived]

#### masterdata.MasterReviewType (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, allow_verdicts:Boolean, require_notes:Boolean
- relations: —
- choices: status=[active,archived]

#### masterdata.MasterFileType (soft-delete) lifecycle:status
- fields: name:Char(255), description:Text, code:Char(100), status:Char(20), is_system:Boolean, sort_order:PositiveInteger, extension:Char(20), mime_type:Char(100), category:Char(50), dcc_affinity:Char(100)
- relations: —
- choices: status=[active,archived]

#### masterdata.Client (soft-delete) lifecycle:status
- fields: name:Char(255), code:Char(20), contact_name:Char(255), email:Char(254), phone:Char(50), studio_type:Char(50), active_projects:JSON, contract_tier:Char(50), portal_access:Boolean, status:Char(30), logo_url:Char(500), headquarters:Char(255), total_billed_usd:Decimal
- relations: —

#### masterdata.ClientContact (soft-delete)
- fields: name:Char(255), role:Char(255), email:Char(254), phone:Char(50), timezone:Char(100), is_primary:Boolean, portal_access:Boolean
- relations: client->masterdata.Client(PROTECT)

#### masterdata.ClientContract (soft-delete) lifecycle:status
- fields: contract_number:Char(100), title:Char(255), effective_date:Date, expiry_date:Date, status:Char(30), nda_signed:Boolean, currency:Char(3), activated_at:DateTime, type:Char(30), value_usd:PositiveBigInteger, document_url:Char(500)
- relations: client->masterdata.Client(PROTECT)
- choices: status=[Draft,Active,Terminated]

#### masterdata.Department (soft-delete)
- fields: code:Char(30), name:Char(255), description:Text, department_type:Char(30), color:Char(20), software_stack:JSON, capacity_hours_weekly:PositiveInteger, utilization_percentage:Float
- relations: parent->masterdata.Department(PROTECT), manager->masterdata.Person(SET_NULL)
- choices: department_type=[production,creative,technical,support,administration]

#### masterdata.Office (soft-delete) lifecycle:is_active
- fields: code:Char(30), name:Char(255), description:Text, office_type:Char(50), timezone:Char(50), country:Char(100), state:Char(100), city:Char(100), address:Text, postal_code:Char(20), phone:Char(30), email:Char(254), working_hours:Char(32), headcount:PositiveInteger, workstations_count:PositiveInteger, render_nodes_count:PositiveInteger, is_active:Boolean, is_headquarters:Boolean
- relations: manager->masterdata.Person(SET_NULL)

#### masterdata.Person (soft-delete) lifecycle:status
- fields: status:Char(20), name:Char(255), description:Text, seniority:Char(32), skills:JSON, timezone:Char(100), security_clearance:Char(64), availability_status:Char(32), email:Char(254), phone:Char(20), date_of_birth:Date, nationality:Char(100)
- relations: user->identity.User(SET_NULL), role->masterdata.Position(SET_NULL), department->masterdata.Department(SET_NULL), team->masterdata.Team(SET_NULL), office->masterdata.Office(SET_NULL)
- choices: status=[draft,active,inactive,archived]

#### masterdata.Position (soft-delete)
- fields: code:Char(30), name:Char(255), description:Text, level:PositiveInteger, is_managerial:Boolean, band_level:Char(50), salary_range:Char(50), employment_type:Char(30)
- relations: department->masterdata.Department(SET_NULL), parent->masterdata.Position(SET_NULL)

#### masterdata.Team (soft-delete)
- fields: code:Char(30), name:Char(255), description:Text, focus_discipline:Char(64), current_project_code:Char(16), utilization_percentage:Float, color:Char(20), capacity:PositiveInteger
- relations: department->masterdata.Department(PROTECT), lead->masterdata.Person(SET_NULL)

#### masterdata.Vendor (soft-delete) lifecycle:status
- fields: name:Char(255), code:Char(20), contact_name:Char(255), email:Char(254), specialization:Char(100), security_tier:Char(100), nda_signed:Boolean, active_tasks_count:PositiveInteger, active_projects:JSON, rating:Decimal, location:Char(255), status:Char(30), logo_url:Char(500), bandwidth_gbps:Decimal, bandwidth_link:Char(500)
- relations: —

#### masterdata.VendorContact (soft-delete)
- fields: name:Char(255), role:Char(255), email:Char(254), phone:Char(50), timezone:Char(100), is_primary:Boolean
- relations: vendor->masterdata.Vendor(PROTECT)

#### masterdata.VendorContract (soft-delete) lifecycle:status
- fields: contract_number:Char(100), title:Char(255), effective_date:Date, expiry_date:Date, status:Char(30), nda_signed:Boolean, currency:Char(3), activated_at:DateTime, type:Char(30), total_value_usd:PositiveBigInteger, security_tier:Char(100)
- relations: vendor->masterdata.Vendor(PROTECT)
- choices: status=[Draft,Active,Terminated]


### audit models (7)

#### audit.Activity (soft-delete) lifecycle:status
- fields: activity_type:Char(50), status:Char(20), description:Text, ip_address:GenericIPAddress, user_agent:Text, duration_seconds:PositiveInteger, project_id:UUID
- relations: user->identity.User(CASCADE)
- choices: activity_type=[page_view,feature_usage,interaction,search,filter,export,import,report,dashboard,notification]; status=[success,failed,pending]

#### audit.APIRequest (soft-delete)
- fields: method:Char(10), path:Char(500), full_path:Text, status_code:PositiveSmallInteger, status_category:Char(20), response_time_ms:PositiveInteger, request_size_bytes:PositiveInteger, response_size_bytes:PositiveInteger, ip_address:GenericIPAddress, user_agent:Text, api_version:Char(20), request_headers:JSON, request_body:JSON, response_headers:JSON, response_body:JSON, error_message:Text
- relations: user->identity.User(SET_NULL)
- choices: method=[GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD]; status_category=[success,client_error,server_error]

#### audit.AuditLog (soft-delete)
- fields: action:Char(50), severity:Char(20), target_type:Char(50), target_id:Char(100), target_name:Char(255), description:Text, ip_address:GenericIPAddress, user_agent:Text, project_id:UUID
- relations: actor->identity.User(SET_NULL)
- choices: action=[create,update,delete,login,logout,permission_change,role_change,import,export,api_call,background_job,error,track]; severity=[debug,info,warning,error,critical]; target_type=[user,organization,team,project,sequence,shot,asset,task,version,review,playlist,media,workflow,delivery,notification,billing,branding,analytics,ai,video,setting]

#### audit.BackgroundJob (soft-delete) lifecycle:status
- fields: job_type:Char(50), status:Char(20), progress:PositiveSmallInteger, description:Text, job_id:Char(100)!u, queue_name:Char(100), worker_id:Char(100), started_at:DateTime, completed_at:DateTime, result_data:JSON, error_message:Text
- relations: —
- choices: job_type=[export,import,report,sync,cleanup,notification,analytics,backup,reindex,other]; status=[queued,started,progress,completed,failed,cancelled]

#### audit.ChangeLog (soft-delete)
- fields: change_type:Char(20), target_type:Char(100), target_id:Char(100), target_name:Char(255), before_values:JSON, after_values:JSON, changed_fields:JSON, description:Text, project_id:UUID
- relations: user->identity.User(SET_NULL)
- choices: change_type=[create,update,delete]

#### audit.ErrorLog (soft-delete)
- fields: severity:Char(20), error_type:Char(50), error_code:Char(100), message:Text, stack_trace:Text, ip_address:GenericIPAddress, user_agent:Text, request_path:Char(500), request_method:Char(10), context_data:JSON, resolved:Boolean, resolved_at:DateTime
- relations: user->identity.User(SET_NULL), resolved_by->identity.User(SET_NULL)
- choices: severity=[debug,info,warning,error,critical,fatal]; error_type=[exception,api_error,database_error,cache_error,file_error,auth_error,validation_error,permission_error,network_error,other]

#### audit.Track (soft-delete)
- fields: event_type:Char(50), event_name:Char(255), session_id:Char(100), page_url:Char(500), page_title:Char(255), element_id:Char(255), element_text:Char(255)
- relations: user->identity.User(CASCADE)
- choices: event_type=[page_view,click,form_submit,search,filter,sort,export,import,download,upload,custom]


### settings models (6)

#### settings.SettingCategory (soft-delete) lifecycle:is_active
- fields: code:Char(50)!u, name:Char(255), description:Text, icon:Char(50), order:PositiveInteger, is_active:Boolean
- relations: —
- choices: code=[general,project,media,workflow,review,delivery,notification,billing,branding,analytics,ai,localization,theme,security]

#### settings.SettingDefinition (soft-delete) lifecycle:is_active
- fields: code:Char(100)!u, name:Char(255), description:Text, data_type:Char(30), scope:Char(20), is_required:Boolean, default_value:Text, help_text:Text, order:PositiveInteger, is_active:Boolean, validation_rules:JSON, choices:JSON, depends_on:Char(100)
- relations: category->settings.SettingCategory(PROTECT)
- choices: data_type=[string,integer,float,boolean,date,datetime,json,text,email,url,phone,color,select,multiple_select]; scope=[system]

#### settings.FeatureFlag (soft-delete) lifecycle:status
- fields: code:Char(100)!u, name:Char(255), description:Text, feature_type:Char(20), status:Char(20), is_enabled:Boolean, percentage:PositiveSmallInteger, start_date:DateTime, end_date:DateTime, config:JSON
- relations: —
- choices: feature_type=[boolean,percentage,scheduled,rollout]; status=[enabled,disabled,scheduled,expired]

#### settings.Localization (soft-delete) lifecycle:is_active
- fields: code:Char(50)!u, name:Char(255), language:Char(10), timezone:Char(50), date_format:Char(30), time_format:Char(10), number_format:Char(10), currency_code:Char(3), currency_symbol:Char(5), week_start:PositiveSmallInteger, fiscal_year_start:Date, is_active:Boolean
- relations: —
- choices: language=[en,hi,es,fr,de,zh,ja,ko,ru,ar]; timezone=[UTC,Asia/Kolkata,Asia/Dubai,Europe/London,Europe/Paris,America/New_York,America/Los_Angeles,Australia/Sydney]; date_format=[YYYY-MM-DD,DD-MM-YYYY,MM-DD-YYYY,YYYY/MM/DD,DD/MM/YYYY,MM/DD/YYYY]; time_format=[24H,12H]; number_format=[dot,comma]

#### settings.SystemSetting (soft-delete)
- fields: value:Text, is_locked:Boolean, locked_at:DateTime
- relations: setting->settings.SettingDefinition(CASCADE), locked_by->identity.User(SET_NULL)

#### settings.Theme (soft-delete) lifecycle:is_active
- fields: code:Char(50)!u, name:Char(255), description:Text, theme_type:Char(20), primary_color:Char(7), secondary_color:Char(7), accent_color:Char(7), background_color:Char(7), surface_color:Char(7), text_primary:Char(7), text_secondary:Char(7), border_color:Char(7), font_family:Char(20), font_size:PositiveSmallInteger, border_radius:PositiveSmallInteger, spacing_unit:PositiveSmallInteger, sidebar_collapsed:Boolean, navbar_fixed:Boolean, is_active:Boolean
- relations: —
- choices: theme_type=[light,dark,custom]; font_family=[sans,serif,mono]


### production models (30)

#### production.Asset (soft-delete) lifecycle:status
- fields: name:Char(255), code:Char(50), category:Char(30), description:Text, status:Char(30), version:Char(20), file_format:Char(100), poly_count:PositiveInteger, lod_levels:PositiveInteger, software:Char(30), thumbnail_url:Char(500), turntable_video_url:Char(500), tags:JSON, usd_prim_path:Char(255), usd_stage_url:Char(500), versions:JSON, hierarchy:JSON
- relations: project->production.Project(CASCADE), show->production.Show(SET_NULL), asset_type->masterdata.MasterAssetType(PROTECT), department->masterdata.Department(SET_NULL), team->masterdata.Team(SET_NULL), assigned_artist->identity.User(SET_NULL), parent_asset->production.Asset(SET_NULL)
- choices: category=[Character,Environment,Vehicle,Prop,FX Rig,Shader & LookDev,Matte Painting,Crowd Agent,Costume / Groom]; status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]; software=[Maya,Houdini,Blender,ZBrush,Substance Painter,Unreal Engine 5,Solaris,Mari]

#### production.AutomationRule (soft-delete) lifecycle:is_active
- fields: name:Char(255), description:Text, trigger_event:Char(100), trigger_entity_type:Char(50), trigger_filters:JSON, conditions:JSON, actions:JSON, is_active:Boolean, required_role:Char(100), execution_count:PositiveInteger, last_triggered_at:DateTime, last_status:Char(20)
- relations: project->production.Project(CASCADE), workflow->production.Workflow(SET_NULL)

#### production.AutomationAuditLog (soft-delete) lifecycle:status
- fields: rule_name:Char(255), workflow_name:Char(255), trigger_event:Char(100), entity_type:Char(50), entity_id:Char(100), entity_code:Char(100), actor_name:Char(255), actor_role:Char(100), executed_at:DateTime, duration_ms:PositiveInteger, status:Char(20), step_logs:JSON, action_logs:JSON
- relations: project->production.Project(CASCADE), rule->production.AutomationRule(SET_NULL), workflow->production.Workflow(SET_NULL), actor->identity.User(SET_NULL)

#### production.EditorialCut (soft-delete) lifecycle:status
- fields: sequence_code:Char(50), name:Char(255), code:Char(50), cut_type:Char(30), version:Char(20), fps:Float, duration_frames:PositiveInteger, duration_tc:Char(20), start_tc:Char(20), end_tc:Char(20), source_edl_filename:Char(255), xml_manifest_url:Char(500), total_shots_in_cut:PositiveInteger, matched_vfx_shots:PositiveInteger, unmatched_shots:PositiveInteger, editorial_notes:Text, editor_name:Char(255), conformed_by:Char(255), status:Char(30), burn_in_lut:Char(255), thumbnail_url:Char(500)
- relations: project->production.Project(CASCADE)
- choices: cut_type=[Conform,Turnover,Rough Cut,Fine Cut,Picture Lock,Trailer Teaser]; status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]

#### production.EditorialTrack (soft-delete) lifecycle:status
- fields: cut_id:Char(100), cut_name:Char(255), track_number:PositiveInteger, track_type:Char(30), name:Char(255), codec_or_format:Char(255), channels_or_resolution:Char(255), frame_rate:Float, is_locked:Boolean, is_muted:Boolean, is_solo:Boolean, color_tag:Char(20), clip_count:PositiveInteger, description:Text, status:Char(30), start_tc:Char(20), end_tc:Char(20)
- relations: project->production.Project(CASCADE)
- choices: track_type=[Video,Audio,VFX Plates,Reference,Subtitles,Markers]; status=[Active,Conformed,Muted,Archived]

#### production.Episode (soft-delete) lifecycle:status
- fields: code:Char(50), name:Char(255), season_number:PositiveInteger, episode_number:PositiveInteger, status:Char(30), description:Text, frame_in:PositiveInteger, frame_out:PositiveInteger, duration_frames:PositiveInteger, air_date:Date, delivery_date:Date
- relations: project->production.Project(CASCADE), show->production.Show(SET_NULL)
- choices: status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]

#### production.Media (soft-delete)
- fields: entity_type:Char(20), entity_id:Char(50), code:Char(100), name:Char(255), title:Char(255), file_name:Char(255), media_type:Char(50), category:Char(50), file_format:Char(100), storage_tier:Char(50), source_url:Char(500), preview_url:Char(500), thumbnail_url:Char(500), file_size_mb:Decimal, resolution:Char(50)
- relations: project->production.Project(CASCADE)

#### production.Playlist (soft-delete) lifecycle:status
- fields: name:Char(255), code:Char(50), description:Text, status:Char(30), client_only:Boolean, share_settings:JSON, activity:JSON
- relations: project->production.Project(CASCADE)

#### production.PlaylistEntry (soft-delete)
- fields: position:PositiveInteger, legacy_id:Char(100), extra:JSON
- relations: playlist->production.Playlist(CASCADE), version->production.Version(PROTECT)

#### production.Project (soft-delete) lifecycle:status
- fields: code:Char(20)!u, name:Char(255), description:Text, type:Char(30), status:Char(30), workflow_type:Char(20), fps:Decimal, resolution:Char(50), aspect_ratio:Char(20), color_space:Char(50), start_date:Date, delivery_date:Date, thumbnail_url:Char(500), total_shots:PositiveInteger, approved_shots:PositiveInteger, in_progress_shots:PositiveInteger, total_assets:PositiveInteger, budget_usd:Decimal, client_id:Char(50), client_name:Char(255), client_contact_id:Char(50), client_contact_name:Char(255), vendor_ids:JSON, vendor_names:JSON, vendor_team_ids:JSON
- relations: supervisor->identity.User(SET_NULL), coordinator->identity.User(SET_NULL)
- choices: type=[Feature Film,Episodic Series,Commercial,Game Cinematic]; status=[In Progress,Pending Review,Approved,Archived,On Hold]; workflow_type=[standard,episodic]

#### production.ProjectMembership (soft-delete) lifecycle:status
- fields: role:Char(100), roles:JSON, scope:Char(30), status:Char(20), department:Char(100), department_id:Char(50), team_id:Char(50), vendor_id:Char(50), client_id:Char(50)
- relations: project->production.Project(CASCADE), show->production.Show(CASCADE), user->identity.User(CASCADE), role_ref->identity.Role(SET_NULL)
- choices: status=[active,on_leave,terminated,suspended]

#### production.ProjectNote (soft-delete) lifecycle:status
- fields: entity_type:Char(20), entity_id:Char(50), entity_code:Char(50), entity_name:Char(255), author_name:Char(255), author_avatar:Char(500), author_role:Char(100), subject:Char(255), body:Text, category:Char(30), priority:Char(20), tags:JSON, status:Char(20), addressed_by:Char(255), addressed_at:DateTime, timecode_ref:Char(20), frame_number:PositiveInteger
- relations: project->production.Project(PROTECT), author->identity.User(SET_NULL)
- choices: category=[Director Feedback,Supervisor Note,Client Note,Pipeline Notice,Turnover Requirement,General]; priority=[Critical,High,Medium,Low]; status=[Open,Addressed,Closed]

#### production.Review (soft-delete) lifecycle:status
- fields: title:Char(255), code:Char(50), description:Text, entity_type:Char(20), entity_id:Char(50), entity_code:Char(50), status:Char(30), supervisor_verdict:Char(30), lead_reviewer_name:Char(255), thumbnail_url:Char(500), video_url:Char(500), client:JSON, vendor:JSON
- relations: project->production.Project(PROTECT), lead_reviewer->identity.User(SET_NULL)

#### production.ReviewItem (soft-delete)
- fields: position:PositiveInteger
- relations: review->production.Review(CASCADE), version->production.Version(PROTECT)

#### production.ReviewParticipant (soft-delete)
- fields: name:Char(255), role:Char(100), legacy_id:Char(100), verdict:Char(30), verdict_notes:Text, verdict_at:DateTime
- relations: review->production.Review(CASCADE), user->identity.User(SET_NULL)

#### production.ReviewComment (soft-delete)
- fields: author_name:Char(255), text:Text, frame_number:Integer, timecode:Char(20), is_client_visible:Boolean, tags:JSON, resolved_at:DateTime
- relations: review->production.Review(CASCADE), parent->production.ReviewComment(CASCADE), author->identity.User(SET_NULL), resolved_by->identity.User(SET_NULL)

#### production.ReviewNote (soft-delete)
- fields: author_name:Char(255), author_role:Char(100), category:Char(50), content:Text, is_pinned:Boolean
- relations: review->production.Review(CASCADE), author->identity.User(SET_NULL)

#### production.ReviewAnnotation (soft-delete)
- fields: author_name:Char(255), frame_number:Integer, timecode:Char(20), comment:Text, drawing_coordinates:JSON
- relations: review->production.Review(CASCADE), author->identity.User(SET_NULL)

#### production.ReviewActivity (soft-delete)
- fields: action:Char(50), verdict:Char(30), notes:Text, actor_email:Char(254)
- relations: review->production.Review(CASCADE), actor->identity.User(SET_NULL)

#### production.Sequence (soft-delete) lifecycle:status
- fields: code:Char(50), name:Char(255), status:Char(30), description:Text, frame_in:PositiveInteger, frame_out:PositiveInteger, department:Char(100), lead_artist_name:Char(255), tags:JSON
- relations: project->production.Project(CASCADE), show->production.Show(SET_NULL), episode->production.Episode(PROTECT), lead_artist->identity.User(SET_NULL)
- choices: status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]

#### production.Shot (soft-delete) lifecycle:status
- fields: code:Char(30), name:Char(255), description:Text, status:Char(30), frame_in:Integer, frame_out:Integer, handle_frames:PositiveInteger, thumbnail_url:Char(500), video_url:Char(500), supervisor_approved:Boolean, client_approved:Boolean, pipeline:JSON
- relations: project->production.Project(CASCADE), show->production.Show(SET_NULL), episode->production.Episode(SET_NULL), sequence->production.Sequence(PROTECT), assigned_artist->identity.User(SET_NULL)
- choices: status=[Not Started,In Progress,Pending Review,Approved,Retake,On Hold,Archived]

#### production.ShotAsset (soft-delete)
- fields: quantity:PositiveInteger, notes:Text
- relations: project->production.Project(CASCADE), shot->production.Shot(PROTECT), asset->production.Asset(PROTECT)

#### production.Show (soft-delete) lifecycle:status
- fields: code:Char(50), name:Char(255), show_type:Char(30), status:Char(30), season:Char(50), description:Text, start_date:Date, delivery_date:Date, thumbnail_url:Char(500), is_primary:Boolean
- relations: project->production.Project(CASCADE)
- choices: show_type=[Feature Film,Episodic Series,Commercial,Trailer,Short]

#### production.StatusHistory
- fields: entity_type:Char(30), entity_id:UUID, entity_code:Char(100), from_status:Char(30), to_status:Char(30), reason:Text, override_kind:Char(40), changed_at:DateTime
- relations: project->production.Project(CASCADE), actor->identity.User(SET_NULL)

#### production.Task (soft-delete) lifecycle:status
- fields: title:Char(255), code:Char(50), entity_type:Char(20), entity_id:Char(50), entity_code:Char(50), entity_name:Char(255), department:Char(100), department_id:Char(50), vendor_id:Char(50), vendor_name:Char(255), vendor_code:Char(50), workflow:JSON, schedule:JSON, dependencies:JSON, description:Text, software:Char(100), tags:JSON, status:Char(30), priority:Char(20), due_date:Date, estimated_hours:Decimal
- relations: project->production.Project(PROTECT), shot->production.Shot(PROTECT), asset->production.Asset(PROTECT), sequence->production.Sequence(PROTECT), task_type->masterdata.MasterTaskType(PROTECT), team->masterdata.Team(SET_NULL), assignee->identity.User(SET_NULL), reviewer->identity.User(SET_NULL)
- choices: status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]; priority=[Critical,High,Medium,Low]

#### production.TaskTemplate (soft-delete) lifecycle:is_active
- fields: name:Char(255), description:Text, entity_type:Char(20), is_active:Boolean
- relations: project->production.Project(CASCADE)
- choices: entity_type=[Shot,Asset]

#### production.TaskTemplateItem (soft-delete)
- fields: name:Char(255), order:PositiveInteger, default_bid_hours:Decimal
- relations: template->production.TaskTemplate(CASCADE), task_type->masterdata.MasterTaskType(PROTECT)

#### production.Timelog (soft-delete) lifecycle:status
- fields: task_code:Char(50), task_title:Char(255), project_code:Char(50), department:Char(100), duration_hours:Decimal, date:Date, billable:Boolean, notes:Text, status:Char(20), approved_at:DateTime, rejection_reason:Text, activity_category:Char(50), hourly_rate_usd:Decimal
- relations: project->production.Project(PROTECT), task->production.Task(CASCADE), person->identity.User(PROTECT), approved_by->identity.User(SET_NULL), adjustment_of->production.Timelog(SET_NULL)
- choices: status=[Draft,Submitted,Approved,Rejected]

#### production.Version (soft-delete) lifecycle:status
- fields: code:Char(100), version_number:Char(20), version_index:PositiveInteger, entity_type:Char(20), entity_id:Char(50), entity_code:Char(50), entity_name:Char(255), department:Char(100), status:Char(30), is_published:Boolean, published_at:DateTime, is_hero:Boolean, thumbnail_url:Char(500), video_url:Char(500), source_file_url:Char(500), frame_range:Char(50), start_frame:Integer, end_frame:Integer, resolution:Char(50), fps:Decimal, file_size_mb:Decimal, color_space:Char(50), file_path:Char(500), notes:Text, changelog:Text, tags:JSON, publishing_info:JSON, media_items:JSON, attachments:JSON, reviews:JSON, playlists:JSON, notes_list:JSON, activity:JSON
- relations: project->production.Project(PROTECT), shot->production.Shot(PROTECT), asset->production.Asset(PROTECT), task->production.Task(PROTECT), artist->identity.User(SET_NULL), published_by->identity.User(SET_NULL)
- choices: status=[Not Started,In Progress,Pending Review,Approved,Retake,Archived]

#### production.Workflow (soft-delete) lifecycle:is_active
- fields: name:Char(255), code:Char(50), description:Text, category:Char(50), is_active:Boolean, department:Char(100), nodes:JSON, transitions:JSON, automation_rules:JSON, execution_stats:JSON
- relations: project->production.Project(CASCADE)


### deliveries models (7)

#### deliveries.DeliveryCounter
- fields: project_id:UUID!u, last_number:PositiveInteger
- relations: —

#### deliveries.DeliveryStatusChange
- fields: from_status:Char(20), to_status:Char(20), reason:Char(500), override_kind:Char(20), at:DateTime
- relations: delivery->deliveries.DeliveryPackage(PROTECT), actor->identity.User(SET_NULL)
- choices: override_kind=[,status,self_approval,system]

#### deliveries.DeliveryItemFile
- fields: published_file_id:UUID, storage_root_code:Char(50), relative_path:Char(1024), role:Char(20), file_type_code:Char(100), size_bytes:PositiveBigInteger, sha256:Char(64), frame_start:Integer, frame_end:Integer, frozen_at:DateTime
- relations: item->deliveries.DeliveryVersionRef(PROTECT)

#### deliveries.DeliveryQCCheck
- fields: run_id:UUID, check_name:Char(40), outcome:Char(12), detail:Char(300), checked_at:DateTime
- relations: delivery->deliveries.DeliveryPackage(PROTECT), item->deliveries.DeliveryVersionRef(PROTECT), checked_by->identity.User(SET_NULL)
- choices: outcome=[pass,fail,not_checked]

#### deliveries.DeliveryPackage (soft-delete) lifecycle:is_archived,status
- fields: name:Char(255), code:Char(50)!u, status:Char(20), client_status:Char(20), delivery_method:Char(20), delivery_destination:Text, passcode:Char(255), expires_at:DateTime, total_size_bytes:PositiveBigInteger, total_frames:PositiveInteger, notes:Text, client_notes:Text, manifest_data:JSON, checksums:JSON, is_archived:Boolean, sent_at:DateTime, transfer_reference:Char(200), qc_run_id:UUID, signed_off_at:DateTime, client_answered_at:DateTime, cancellation_reason:Char(500), rejection_reason:Char(500)
- relations: project->production.Project(PROTECT), client->masterdata.Client(PROTECT), destination->deliveries.DeliveryDestination(PROTECT), sent_by->identity.User(SET_NULL), signed_off_by->identity.User(SET_NULL), client_answered_by->identity.User(SET_NULL), revision_of->deliveries.DeliveryPackage(PROTECT)
- choices: status=[Draft,Validating,Prepared,Signed Off,Submitted,Approved,Rejected,Complete,Cancelled]; client_status=[Pending,In Review,Approved,Rejected]; delivery_method=[Aspera,S3,FTP,Web Download]

#### deliveries.DeliveryVersionRef
- fields: uid:UUID!u, version_number:Char(50), entity_type:Char(50), entity_code:Char(255), entity_name:Char(255), file_size_bytes:PositiveBigInteger, frame_count:PositiveInteger, file_path:Char(500), checksum_md5:Char(32), checksum_sha256:Char(64), is_validated:Boolean, validation_notes:Text
- relations: delivery->deliveries.DeliveryPackage(PROTECT), version->production.Version(PROTECT), added_by->identity.User(SET_NULL)

#### deliveries.DeliveryDestination (soft-delete) lifecycle:is_active
- fields: name:Char(255), destination_type:Char(30), endpoint:Char(500), credentials_configured:Boolean, transfer_rate_mbps:PositiveInteger, storage_region:Char(255), port:PositiveInteger, target_directory:Char(500), is_default:Boolean, is_active:Boolean
- relations: —
- choices: destination_type=[Aspera Connect,Signiant Media Shuttle,AWS S3 Bucket,Frame.io Enterprise,LTO Tape Archive,Client SFTP,Hard Drive Ingest]


### publishing models (7)

#### publishing.PublishCounter
- fields: project_id:UUID!u, last_number:PositiveInteger
- relations: —

#### publishing.PublishedFile (soft-delete) lifecycle:status
- fields: relative_path:Char(1024), role:Char(20), size_bytes:BigInteger, sha256:Char(64), frame_start:Integer, frame_end:Integer, checksum_state:Char(10), checksum_checked_at:DateTime, status:Char(12), status_changed_at:DateTime, revoke_reason:Text
- relations: version->production.Version(PROTECT), project->production.Project(PROTECT), storage_root->publishing.StorageRoot(PROTECT), file_type->masterdata.MasterFileType(PROTECT), status_changed_by->identity.User(SET_NULL), export_job->publishing.PublishItem(PROTECT)
- choices: role=[main,proxy,thumbnail,sidecar]; checksum_state=[declared,verified,mismatch,missing]; status=[Registered,Deprecated,Revoked]

#### publishing.PublishedFileEvent
- fields: kind:Char(14), from_status:Char(12), to_status:Char(12), detail:Char(40), reason:Text, override_kind:Char(40), at:DateTime
- relations: file->publishing.PublishedFile(PROTECT), actor->identity.User(SET_NULL)
- choices: kind=[registered,status,verification]

#### publishing.StorageRoot (soft-delete) lifecycle:is_active
- fields: code:Char(50), name:Char(255), linux_path:Char(500), windows_path:Char(500), mac_path:Char(500), is_active:Boolean
- relations: —

#### publishing.PublishItem (soft-delete) lifecycle:is_archived,status
- fields: name:Char(255), code:Char(50), cancel_reason:Text, entity_type:Char(20), entity_id:Char(100), entity_code:Char(255), entity_name:Char(255), dcc_tool:Char(20), dcc_version:Char(50), source_file:Char(500), source_version:Char(50), export_path:Char(500), export_format:Char(50), status:Char(20), validation_rules:JSON, validation_results:JSON, export_options:JSON, error_message:Text, retry_count:PositiveInteger, is_archived:Boolean
- relations: project->production.Project(PROTECT), version->production.Version(PROTECT), republished_from->publishing.PublishItem(PROTECT)
- choices: entity_type=[Shot,Asset]; dcc_tool=[Maya,Houdini,Blender,Nuke,Maya Light,Cinema 4D,3ds Max,Unreal,USD]; status=[Pending,Validating,Validated,Exporting,Exported,Failed,Cancelled]

#### publishing.PublishValidationRule lifecycle:is_active
- fields: name:Char(100), rule_type:Char(50), action:Char(20), config:JSON, is_active:Boolean, order:PositiveInteger
- relations: —
- choices: rule_type=[file_exists,file_size,frame_range,file_format,metadata,dependencies,permissions]; action=[warn,error,block]

#### publishing.PublishDestination (soft-delete) lifecycle:is_active
- fields: name:Char(255), destination_type:Char(30), path:Char(500), protocol:Char(20), is_default:Boolean, region:Char(255), is_active:Boolean
- relations: —
- choices: destination_type=[Storage Cluster,Client Delivery Ingest,Render Farm Cache,Cloud S3 Bucket,Vendor Ingest,Daily Review Repo,USD Asset Cache]; protocol=[NFS,SMB,S3,Aspera,Local POSIX]


### scheduling models (7)

#### scheduling.CalendarEvent (soft-delete) lifecycle:status
- fields: title:Char(255), description:Text, event_type:Char(20), status:Char(20), visibility:Char(20), start_time:DateTime, end_time:DateTime, is_all_day:Boolean, location:Char(255), meeting_url:Char(200), notes:Text
- relations: project->production.Project(PROTECT)
- choices: event_type=[Meeting,Deadline,Milestone,Review Session,Holiday,Leave,Work Block]; status=[Scheduled,In Progress,Completed,Cancelled,Postponed]; visibility=[Private,Team,Organization,Public]

#### scheduling.Resource (soft-delete) lifecycle:status
- fields: name:Char(255), code:Char(50)!u, resource_type:Char(20), status:Char(20), capacity_hours_per_week:PositiveInteger, hourly_rate_usd:Decimal, location:Char(255)
- relations: department->masterdata.Department(SET_NULL), team->masterdata.Team(SET_NULL), user->identity.User(SET_NULL), calendar->scheduling.WorkCalendar(PROTECT)
- choices: resource_type=[Person,Equipment,Room,Studio]; status=[Active,On Leave,Unavailable]

#### scheduling.ResourceSchedule (soft-delete) lifecycle:status
- fields: start_time:DateTime, end_time:DateTime, status:Char(20), notes:Text
- relations: resource->scheduling.Resource(PROTECT), event->scheduling.CalendarEvent(SET_NULL), task->production.Task(SET_NULL)
- choices: status=[Booked,Available,Blocked,Overbooked]

#### scheduling.ResourceLeave (soft-delete) lifecycle:status
- fields: leave_type:Char(20), status:Char(20), start_date:Date, end_date:Date, total_days:PositiveInteger, reason:Text, approved_at:DateTime, rejected_at:DateTime, rejection_reason:Text
- relations: resource->scheduling.Resource(PROTECT), approved_by->identity.User(SET_NULL), rejected_by->identity.User(SET_NULL)
- choices: leave_type=[Vacation,Sick Leave,Personal,Unpaid,Parental,Bereavement,Other]; status=[Pending,Approved,Rejected,Cancelled]

#### scheduling.Holiday (soft-delete)
- fields: name:Char(255), holiday_date:Date, is_paid:Boolean, is_optional:Boolean, description:Text
- relations: calendar->scheduling.WorkCalendar(PROTECT)

#### scheduling.WorkCalendar (soft-delete)
- fields: code:Char(50), name:Char(255), time_zone:Char(64), working_weekdays:JSON, hours_per_day:Decimal, is_default:Boolean
- relations: office->masterdata.Office(PROTECT)

#### scheduling.Milestone (soft-delete) lifecycle:status
- fields: name:Char(255), due_date:Date, status:Char(20), order:PositiveInteger, kind:Char(20), delivery_package_id:UUID, notes:Text, completed_at:DateTime
- relations: project->production.Project(PROTECT), completed_by->identity.User(SET_NULL)
- choices: status=[Pending,In Progress,Completed]; kind=[general,delivery]

