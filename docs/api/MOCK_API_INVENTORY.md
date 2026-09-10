# StudioHub React — Mock API Inventory

Source of truth: `/home/prafull.sakharkar/Repository/github/studiohub-react/src`
(mock authority = `src/mocks/mockRouter.ts`; MSW `src/mocks/handlers/*` is dormant
by default — `main.tsx:27` calls `enableMocking()`, which starts the worker only
when `VITE_USE_MSW=true|1`. `ApiClient.dispatch` is mock-first, network fallback
on `mockRouter` miss — despite the "STRICT RULE: No fallback" comment in
`api/repositories/config.ts:4-8`. The Django backend must therefore assume any
path without `mockRouter` coverage hits the live network even in mock mode.)

 freshness: re-verified 2026-09-10; Django statuses marked `(implemented)` were
 completed 2026-09-08 unless noted otherwise.

Global conventions (apply to every endpoint below unless noted):

- **Base URL**: `VITE_API_URL` or relative (`''`). Mode switch: `VITE_API_MODE=mock|rest|live`
  (default `mock`) or `localStorage vfx_api_mode_override`. REST adapters: `REST*Adapter`.
- **Authentication**: `Authorization: Bearer <access>` (localStorage `studiohub_access_token`;
  auto-refresh via `POST /api/v1/auth/refresh/`). `skipAuth` only for login/refresh.
- **Organization scope**: header `X-Organization-Id: <activeOrgId>` on every `ApiClient`
  request (+ persisted `studiohub_active_org_id`; switch invalidates all queries).
- **Pagination (list)**: `?page=&page_size=` (or `limit`); response
  `{"count":N,"next":URL|null,"previous":URL|null,"results":[...]}`. Exceptions returning
  **bare arrays** are marked `RAW[]` below.
- **Filtering**: `?search=` substring over endpoint-specific fields; any other query key =
  exact match (`status, project_id, department, …`). `?ordering=field|-field`.
- **Errors**: `{"detail":str}` / `{"non_field_errors":[str]}` / `{"field":["msg"]}`;
  400 validation, 401 unauthenticated, 403 forbidden, 404 `{detail}`, 409 conflict, 204 empty.
- **IDs**: frontend mock ids are strings (`proj-001`, `usr-001`, …); detail routes accept
  id **or** `code` (case-insensitive).

---

## 1. Auth

### POST /api/v1/auth/login/
- Auth: none (`skipAuth`). Org: n/a. Query: —.
- Request: `{"email":str,"password":str}`. Response 200:
  `{"tokens":{"access":str,"refresh":str},"user":User}`; 401 unknown account; 400 bad password.
- Frontend: `modules/auth/repositories/AuthRepository.ts:14`, `RESTAuthAdapter`,
  `MockAuthAdapter`. Mock: `handlers/authHandlers.ts:10`, `mockRouter.ts:580`.
- Django: `POST /api/v1/auth/login/` (`AuthLoginView`) — MATCH.

### POST /api/v1/auth/refresh/
- Auth: none. Request: `{"refresh":str}`. Response 200 `{"access":str}`; 400 if missing.
  Also used internally by `ApiClient` 401-retry.
- Frontend: `AuthRepository.ts:25`, `ApiClient.ts:76`. Mock: `authHandlers.ts:45`, `mockRouter.ts:607`.
- Django: `POST /api/v1/auth/refresh/` — MATCH.

### POST /api/v1/auth/logout/
- Auth: required. Request: —. Response 200 `{"detail":str}`.
- Frontend: `AuthRepository.ts:35`. Mock: `authHandlers.ts:62`, `mockRouter.ts:619`.
- Django: `POST /api/v1/auth/logout/` — MATCH.

### GET /api/v1/auth/me/
- Auth: required. Response 200 `User`; 401 without Bearer.
- Frontend: `AuthRepository.ts:39`, `RESTAuthAdapter.getCurrentUser`.
  Mock: `authHandlers.ts:68`, `mockRouter.ts:626`.
- Django: `GET /api/v1/auth/me/` — MATCH.

### GET /api/v1/auth/memberships/
- Auth: required. Query: —. Request: —.
  Response 200 `OrganizationMembership[]` (`id,user_id,organization_id,organization_name,`
  `organization_code?,organization_slug?,role,permissions[],is_default?,status,department?,joined_at?`).
- Frontend: NO `apiClient` caller — memberships are read embedded off `User`
  (`core/auth/AuthProvider.tsx:148-171`). Routes exist in mock only.
  Mock: `authHandlers.ts:87`, `mockRouter.ts:635`.
- Django: MATCH (implemented: `AuthMembershipsView` + alias).

### GET /api/v1/users/me/memberships/
- Same contract as above (alias). Mock-only routes, no caller.
- Frontend: same consumers. Mock: `authHandlers.ts:98`, `mockRouter.ts:635`.
- Django: MATCH (implemented as alias).

---

## 2. Projects (`/api/v1/projects/`)

### GET /api/v1/projects/
- Auth: required. Org: header + `?organization_id=` honored. Query: `search`
  (name/code/description/client_name), `ordering`, `page/page_size/limit`, exact field filters.
- Response 200 paginated `Project[]`; 401/403 guarded.
- Frontend: `modules/production/repositories/ProjectRepository.ts:13`,
  `services/ProjectService.ts`, `hooks/useProjects.ts:19`, `RESTProjectAdapter`.
  Mock: `handlers/projectHandlers.ts:15`, `mockRouter.ts:685`.
- Django: `GET /api/v1/projects/` (`ProjectViewSet`) — MATCH (implemented
  2026-09-10: `client_name` in filterset search; `organization_id` accepted and
  resolved server-side, fail-closed).

### GET /api/v1/projects/{id}/
- `{id}` = id or code. Response 200 `Project`; 401/403/404.
- Frontend: `ProjectRepository.findById`, `TestRunnerEngine.ts:85`. Mock: `projectHandlers.ts:30`.
- Django: `GET /api/v1/projects/{uuid}/` — PARTIAL (UUID lookup only; add id-or-code).

### POST /api/v1/projects/
- Request `Partial<Project>`; requires `name,code` (400 `{name?,code?}`); defaults
  `type=Feature Film, status=In Progress, fps=24, organization=user org`.
- Response 201 `Project`.
- Frontend: `ProjectRepository.create`. Mock: `projectHandlers.ts:53`, `mockRouter.ts:700`.
- Django: `POST /api/v1/projects/` — MATCH (verify required-field errors + defaults).

### PATCH|PUT /api/v1/projects/{id}/ — 200 `Project`; 404. Django: MATCH (router PUT+PATCH).
### DELETE /api/v1/projects/{id}/ — 204; 404. Django: MATCH.

### GET /api/v1/projects/{id}/statistics/
- Auth: required. Response 200 `Record<string,number>`.
- Frontend: `RESTProjectAdapter.getStatistics` only (no mock — network fallthrough).
- Django: MATCH (implemented: `ProjectViewSet.statistics`).

---

## 3. Sequences (`/api/v1/sequences/`)

List query: `project_id, include_deleted, search(code/name/description/department/lead_artist),
ordering, page/page_size`. Detail `{id}` = id or code.

### GET /api/v1/sequences/ — 200 paginated `Sequence[]`.
Frontend: `modules/sequences/repositories/SequenceRepository.ts:20`, `useSequences.ts`.
Mock: `sequenceHandlers.ts:24`, `mockRouter.ts:762`.
Django: `GET /api/v1/sequences/` — MATCH (add `lead_artist` search, `include_deleted`).

### GET /api/v1/sequences/{id}/ — 200 `Sequence`; 404. Django: PARTIAL (UUID only).
### POST /api/v1/sequences/ — `Partial<Sequence>` (defaults project, uppercase code,
status `In Progress`) → 201. Django: MATCH.
### PATCH|PUT /api/v1/sequences/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/sequences/{id}/ — 204 (mock soft-deletes). Django: MATCH (soft delete).
### POST /api/v1/sequences/{id}/archive/ — 200 archived. Django: MATCH (implemented).
### POST /api/v1/sequences/{id}/restore/ — 200 restored. Django: MATCH.
### POST /api/v1/sequences/check-existence/
- Request: `{"project_id":str,"codes":[str]}`. Response 200:
  `{"items":[{"code":str,"state":"NEW|EXISTS|SOFT_DELETED|DUPLICATE_IN_REQUEST|INVALID",`
  `"existing_entity"?:obj,"message"?:str}]}` (mockRouter also accepts `check_existence/`).
- Frontend: `SequenceRepository.checkExistence:24`. Mock: `sequenceHandlers.ts:244`.
- Django: MATCH (implemented: both `check-existence/` and legacy `existence-check/`).

### POST /api/v1/sequences/bulk-create/
- Request: `{"project_id":str,"items":[{"code":str,"action":"skip|recover|create","data":obj}]}`.
  Response 200 `BulkOperationResponse` =
  `{"operation_id":str,"timestamp":str,"summary":obj,"results":[],"partial_success":bool}`.
- Frontend: `SequenceRepository.bulkCreate`. Mock: `sequenceHandlers.ts:301`.
- Django: `POST bulk-create/` — MATCH (verify shape).

### POST /api/v1/sequences/bulk-update/ — `{"ids":[],"changes":{}}` → 200 bulk response. Django: MATCH (accepts POST+PATCH).
### POST /api/v1/sequences/bulk-archive/ — `{"ids":[]}` → 200 `{operation_id,summary:{total,archivedCount},results}`. Django: MATCH (verify shape).
### POST /api/v1/sequences/bulk-restore/ — → 200 `{…,restoredCount}`. Django: MATCH (verify).
### GET /api/v1/sequences/archived/ — Django-only extra (no frontend use). Keep.

---

## 4. Shots (`/api/v1/shots/`)

List query: `project_id, sequence_code|sequence, include_deleted, search(code/name/description/
sequence_code/department), ordering, pagination`. Detail = id or code.

### GET /api/v1/shots/ — 200 paginated `Shot[]`.
Frontend: `modules/shots/repositories/ShotRepository.ts:20`, `useShots.ts`.
Mock: `shotHandlers.ts:23`, `mockRouter.ts:1069`.
Django: MATCH (implemented 2026-09-10: `sequence` alias of `sequence_code`;
`include_deleted` global).

### GET /api/v1/shots/{id}/ — 200; 403/404. Django: PARTIAL (UUID only).
### POST /api/v1/shots/ — `Partial<Shot>`; duplicate code → 409 `{detail,code:EXISTS_SOFT_DELETED}`
if archived else 400 `{code:[]}`; defaults frames 1001–1120, pipeline all `Not Started`. → 201.
Django: PARTIAL (no duplicate-code 409).
### PATCH|PUT /api/v1/shots/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/shots/{id}/ — 204. Django: MATCH.
### POST /api/v1/shots/{id}/archive/ — 200. Django: MATCH (implemented).
### POST /api/v1/shots/{id}/restore/ — 200. Django: MATCH (implemented).
### POST /api/v1/shots/{id}/approve/ — 200 approved. Django: MATCH.
### POST /api/v1/shots/check-existence/ — same shape as sequences. Django: MATCH (implemented).
### POST /api/v1/shots/bulk-create|bulk-update|bulk-archive|bulk-restore/ — bulk shapes. Django: MATCH (implemented).

---

## 5. Assets (`/api/v1/assets/`)

List query: `project_id, status, include_archived|include_deleted, search(name/code/category/
description), pagination`. Detail = id or code.

### GET /api/v1/assets/ — 200 paginated `Asset[]`.
Frontend: `modules/assets/repositories/AssetRepository.ts:20`, `useAssets.ts`.
Mock: `assetHandlers.ts:29`, `mockRouter.ts:1436`.
Django: MATCH (add `include_archived`).
### GET /api/v1/assets/{id}/ — 200; 401/403/404. Django: PARTIAL (UUID only).
### POST /api/v1/assets/ — defaults project `proj-001`, category `Prop`, status `Not Started` → 201. Django: MATCH (server-side defaults).
### PATCH|PUT /api/v1/assets/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/assets/{id}/ — 204. Django: MATCH.
### POST /api/v1/assets/{id}/archive|restore/ — 200. Django: MATCH (implemented).
### POST /api/v1/assets/check-existence/ — same shape. Django: MATCH (implemented).
### POST /api/v1/assets/bulk-create|bulk-update|bulk-archive|bulk-restore/ — Django: MATCH (implemented).

---

## 6. Tasks (`/api/v1/tasks/`) + Timelogs (`/api/v1/timelogs/`)

Tasks list query: `project_id, entity_type, entity_id, department, team_id, assignee_id,
vendor_id, status, priority, is_archived, include_archived, search(title/code/entity_code/
entity_name/assignee_name/department/software/description)`.

### GET /api/v1/tasks/ — 200 paginated `Task[]`.
Frontend: `modules/tasks/repositories/TaskRepository.ts:20`, `useTasks.ts`.
Mock: `taskHandlers.ts:29`, `mockRouter.ts:1746`.
Django: MATCH (implemented 2026-09-10: `project_id,team_id,assignee_id` UUID
aliases + `vendor_id` iexact; `is_archived` + global `include_archived`).
### GET /api/v1/tasks/{id}/ — 200; 404. Django: MATCH.
### POST /api/v1/tasks/ — `Partial<Task>` → 201. Django: MATCH.
### PATCH|PUT /api/v1/tasks/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/tasks/{id}/ — 204. Django: MATCH.
### POST /api/v1/tasks/{id}/archive|restore/ — 200. Django: MATCH (implemented).
### POST /api/v1/tasks/check-existence/ — Django: MATCH (implemented).
### POST /api/v1/tasks/bulk-create/ — Django: MATCH (implemented).
### POST /api/v1/tasks/bulk-update/ — Django: MATCH (implemented).
### POST /api/v1/tasks/bulk-assign/ — `{task_ids?,assignee_id,…}` → 200 `{success,updated_count}`. Django: MATCH (shape verified).
### POST /api/v1/tasks/bulk-status/ — `{…,status}` → `{success,updated_count}`. Django: MATCH.
### POST /api/v1/tasks/bulk-archive/ — Django: MATCH (verify response shape vs `{success,updated_count}`).
### POST /api/v1/tasks/bulk-delete/ — `{ids}` → `{success,deleted_count}`. Django: MATCH.

Timelogs query: `task_id,person_id,project_id,status,billable,start_date,end_date,search
(task_title/code/person/project/notes)`, sorted date desc.

### GET /api/v1/timelogs/ — 200 paginated `Timelog[]`.
Frontend: `modules/tasks/repositories/TimelogRepository.ts:12`, `useTimelogs.ts`.
Mock: `timelogHandlers.ts:10`, `mockRouter.ts:2080`. Django: MATCH (verify date sort default).
### GET /api/v1/timelogs/{id}/ — 200; 404. Django: MATCH.
### POST /api/v1/timelogs/ — `Partial<Timelog>` → 201. Django: MATCH.
### PATCH|PUT /api/v1/timelogs/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/timelogs/{id}/ — 204. Django: MATCH.
### POST /api/v1/timelogs/{id}/approve/ — `{approved_by_id?,approved_by_name?}` → 200 Approved. Django: MATCH.
### POST /api/v1/timelogs/{id}/reject/ — `{rejection_reason?}` → 200 Rejected. Django: MATCH.

---

## 7. Reviews (`/api/v1/reviews/`)

List query: `search(title/code/entity_code/lead_reviewer_name)` + `project_id,entity_code,status,client_only`.
Entity: `ReviewSession` (+ nested annotations/comments/notes/reviewers/participants).

### GET /api/v1/reviews/ — 200 paginated. Frontend: `ReviewRepository.findAll`, `useReviews.ts`. Django: MATCH.
No `client_only` on reviews (verified 2026-09-10: no caller sends it; `client_only`
is a Playlist field) and no reviewer-name search path — doc ask withdrawn, no change.
### GET /api/v1/reviews/{id}/ — 200; 404. Django: MATCH.
### POST /api/v1/reviews/ — `Partial<ReviewSession>` → 201. Django: MATCH.
### PATCH|PUT /api/v1/reviews/{id}/ — 200. Django: MATCH.
### POST /api/v1/reviews/{id}/annotations/ — `Partial<ReviewAnnotation>` → 201. Django: MATCH.
### POST /api/v1/reviews/{id}/verdict/ — `{verdict:Approved|Retake|Changes Requested|Pending Review,notes?}` → 200. Django: MATCH.
### POST /api/v1/reviews/{id}/submit|start-review|approve|reject|request-changes|close/ — `{}` or `{notes,actor_name}` → 200. Django: MATCH (all six).
### POST /api/v1/reviews/{id}/comments/ — `Partial<ReviewComment>` → 200/201. Django: MATCH.
### POST /api/v1/reviews/{id}/comments/{commentId}/resolve|reopen/ — `{}` → 200. Django: MATCH.
### POST /api/v1/reviews/{id}/notes/ — `Partial<ReviewNote>` → 200/201. Django: MATCH.
### POST /api/v1/reviews/{id}/participant-verdict/
- Request: `{"participant_id":str,"verdict":str,"notes"?:str}` → 200 `ReviewSession`.
- Frontend: `ReviewRepository.updateParticipantVerdict` (no mock — direct network).
- Django: MATCH (implemented).

---

## 8. Versions / Media / Attachments / Playlists

### GET /api/v1/versions/ — query `project_id,entity_type,entity_id,department,status,is_published,search` → 200 paginated.
Frontend: `VersionService.getVersions`, `projectScopedApi.getVersions`.
Mock: `versionHandlers.ts:16`, `mockRouter.ts:3836`. Django: MATCH.
### GET /api/v1/versions/{id}/ — 200; 401/403/404. Django: MATCH.
### POST /api/v1/versions/ — requires `entity_code,version_number` (400 field errors) → 201. Django: MATCH (verify required errors).
### PATCH|PUT /api/v1/versions/{id}/ — 200. Django: MATCH.
### DELETE /api/v1/versions/{id}/ — 204. Django: MATCH.
### POST /api/v1/versions/{id}/publish|unpublish|archive/ — `{}` → 200. Django: MATCH.
### POST /api/v1/versions/{id}/add-to-playlist/ — `{playlist_id,…}` → 200. Django: MATCH.
### POST /api/v1/versions/{id}/promote/ — mock-only, no caller. Django: has `promote/` extra. Keep.

### Media — GET /api/v1/media/ (`entity_type,entity_id,media_type,project_id,search`) → **bare `MediaItem[]`** in mockRouter (`return {data:list}`); `MediaService` expects **RAW `MediaItem[]`** — shapes agree.
GET|POST|PATCH|DELETE `/:id/`.
Frontend: `modules/media/services/MediaService.ts`. Mock: `mockRouter.ts:4322-4355` (no MSW).
Django: `MediaViewSet pagination=None` (bare array) — MATCH service expectation.

### Attachments — GET /api/v1/attachments/ (`entity_type,entity_id,category,search`); GET|POST|DELETE `/:id/`; `AttachmentService` expects **RAW `AttachmentItem[]`**.
Frontend: `modules/attachments/services/AttachmentService.ts`. Mock: `mockRouter.ts:4201`.
Django: core `AttachmentViewSet` paginated — **MISMATCH** (must return bare array at compat prefix).

### Playlists — GET /api/v1/playlists/ (`project_id,search,client_only,status`) → **bare array** in mockRouter (`return {data:list}`), but the caller (`BaseRepository.findAll`) expects **paginated** — the mock itself is broken for `findAll` (client reads `.results` of an array). The typed contract (paginate) is authoritative.
Frontend: `modules/playlists/repositories/PlaylistRepository.ts` (`BaseRepository` → expects paginated list). Mock: `mockRouter.ts:4481-4500` (no MSW).
Django: actions MATCH; list paginated (`StandardPagination`) — MATCH the typed contract.

---

## 9. Organizations — flat `/api/v1/`

### GET /api/v1/organizations/ — `search/status/tier/location/ordering`; **RAW `Organization[]`** unless `page|page_size` present (then paginated). 401/403-guarded.
Frontend: `organizationApi.getOrganizations` (array) + `getOrganizationsPaginated`.
Mock: `organizationHandlers.ts:760`, `mockRouter.ts:2699`.
Django: legacy conditional pagination — MATCH.

### GET /api/v1/organizations/{id}/ (id|code|slug) — 200. Django: MATCH.
### POST /api/v1/organizations/ — 201. Django: MATCH.
### PATCH /api/v1/organizations/{id}/ (`{status:Archived|Active}` archive/restore) — 200. Django: MATCH (serializer must accept status).
### DELETE /api/v1/organizations/{id}/ — 204. Django: MATCH.

### GET /api/v1/departments|teams|offices/ — require org (query `organization_id|organizationId`, header `X-Organization-Id`, or user org); **RAW arrays**; id-or-code detail; full CRUD (PATCH/DELETE).
Frontend: `organizationApi.getDepartments/Teams/Offices…` (+detail/create/update/delete).
Mock: `organizationHandlers.ts:799,818,837`. Django: legacy bare-array + id-or-code — MATCH.

### GET /api/v1/people|clients|vendors/ — same org requirement; `search` + **paginated** (default 15); full CRUD; archive/restore via PATCH `{status}`.
Frontend: `organizationApi.getPeople/Clients/Vendors…`. Mock: `organizationHandlers.ts:856,880,903`.
Django: MATCH (clients/vendors have `restore/` action; people archive via PATCH status — verify).

### GET|POST /api/v1/positions|invitations|work-calendars|work-hours|calendars|holidays|roles|groups|permissions|api-keys|pats/ (+detail, PATCH, DELETE; `POST /invitations/{id}/resend/`, PATCH `{status:Revoked}` cancel, PATCH api-keys `{status:Revoked}`)
- All expect **RAW arrays** on list; single objects otherwise.
- Frontend: `organizationApi.getPositions/getInvitations/getWorkCalendars/getWorkHours/getCalendars/getHolidays/getRoles/getGroups/getPermissions/getApiKeys…` (+ PATs).
- Mock: NONE in `mockRouter` except `GET /roles/`, `/roles/:id/`, `/permissions/`,
  which return **paginated** (`mockRouter.ts:781-816`) while callers type bare
  `AccessRole[]` / `PermissionDefinition[]` — same mock-side bug class as playlists
  (frontend-owned; Django stays bare per the typed contract — confirm with owners
  before changing either side).
- Django: flat bare-array aliases implemented (`Compat*ViewSet`) — MATCH (invitation
  `Revoked→cancelled`, api-keys/pats `status↔is_active` mapping included).

### GET /api/v1/organization/ (singular) — 200 current org object.
Frontend: `DashboardService`. Mock: `organizationHandlers.ts:940`, `mockRouter.ts:4543`.
Django: legacy singleton — MATCH.

### GET|PATCH /api/v1/billing/ — 200 `StudioBilling` object (mock `organizationHandlers.ts:927`).
Frontend: org billing callers. Django: `BillingView` — MATCH (verify shape).
### GET /api/v1/reports/ — 200 (mock array/object). Django: stub `[]` — verify vs caller.
### GET /api/v1/notifications/ — Django: stub `[]` — verify vs caller.
### GET /api/v1/audit/ (+ POST mock-only, uncalled) — `AuditRepository` (`/api/v1/audit`), `useAuditLogs.ts` (sends `page,page_size,search,action,organization_id`).
Mock: `auditHandlers.ts:9,18`, `mockRouter.ts:2805-2825` (paginated).
Django: MATCH (implemented 2026-09-10: flat list-only alias `audit-flat-list`
reusing the read-only selector/filter/permission stack, `AuditLogFrontendSerializer`
[`entity_*/user_*` shape], `search_fields` incl. actor email/display-name, `action`
matched case-insensitively against lowercase DB choices; POST stays unrouted —
audit is append-only).

### GET /api/v1/roles/?category, GET /api/v1/roles/{id}/, GET /api/v1/permissions/?resource&category — callers type bare arrays; mockRouter returns paginated (see flat-alias note above — frontend-owned mismatch).
Frontend: RBAC stores, `core/permissions`. Mock: `mockRouter.ts:781-816`.
Django: covered by flat bare-array aliases (typed contract).

### GET /api/v1/analytics/kpis|departments/ — objects. Django: production analytics stubs — MATCH (verify shape).
### GET /api/v1/settings/pipeline/ + PATCH — mock-only, NO caller (verified 2026-09-10:
`SettingsPage.tsx` renders pipeline defaults locally; no `apiClient` call in
`modules/settings/`).
Mock: `settingsHandlers.ts:9,15`, `mockRouter.ts:4768-4776`. Django: intentionally
not implemented — no contract caller (revisit if a caller lands).

---

## 10. Organizations — nested `/api/organizations/{orgId}/…` (no `/v1/`, slashless list)

Preferred by `organizationApi` whenever active org is known. `{orgId}` = id|code|slug.
Nested collections (list Glen):
- **Paginated**: `clients, vendors, people` (GET list; GET detail `/{id}/`; POST; PATCH; DELETE;
  archive/restore via PATCH `{status}`).
- **RAW arrays**: `departments, teams, offices, positions, invitations (+POST /{id}/resend/),
  work-calendars, work-hours, calendars, holidays, roles, groups, permissions, api-keys, pats`
  (GET list; GET `/{id}/`; POST; PATCH; DELETE; 404 `{detail}`).
- Frontend: `organizationApi.*` (all `*Detail/create/update/delete/*` variants).
  Mock: `organizationHandlers.ts:90-755`, `mockRouter.ts:2809-3415`.
- Django: MATCH (implemented: slash-optional nested router, per-resource pagination).

---

## 11. Project-scoped `/api/organizations/{orgId}/projects/{projectId}/…` (no `/v1/`, slashless)

Caller: `modules/production/api/projectScopedApi.ts` via `useProjectScopedData`
(`queryKey ['organizations',orgId,'projects',projectId,sub]`). `{projectId}` = id or code.
Mock: `handlers/projectScopedHandlers.ts:131-738`, `mockRouter.ts:322-695`
(+ `?mock_error=` simulation — mock-only concern). NOTE: the `mockRouter`
subpath chain covers summary/sequences/shots/tasks/assets/versions/reviews/
editorial/notes/deliveries/schedule/resources/pipeline/files/activity only —
**no `members` branch**, so `GET|POST …/members` is MSW-only and falls through
to network in default mock mode.

### GET|POST `…/members` — GET → `{"count":N,"results":[ProjectMembership]}`; POST
`{userId|user_id|email,role,roles?,scope?}` → 201 membership. 404 if project/user unknown.
Django: MATCH (implemented: `ProjectMembership` model + endpoints).

### GET `…/summary` — 200 `{project,counts:{sequences,shots,tasks,assets,versions,reviews,deliveries,notes,editorial,approved_shots,in_progress_shots,completed_tasks},organization_id,project_id}`; 403 without project access; 404 unknown project.
Django: MATCH (implemented).

### GET `…/sequences|shots|tasks|assets|versions|reviews/` — 200 paginated (same list shapes as §3–§8; shots/tasks/assets scope-filtered by membership in mock — backend enforces org scope; project filter from URL).
Django: MATCH (implemented).

### GET `…/editorial/` — 200 paginated `EditorialCut[]`. Django: MATCH (implemented).

### GET|POST `…/notes/` — 200 paginated `ProjectNote[]`; POST `Partial<ProjectNote>` → 201. Django: MATCH (implemented).

### GET `…/deliveries/` — 200 paginated `DeliveryPackage[]`. Django: MATCH (implemented nested list).

### GET `…/schedule/` — 200 `{project_id,start_date,delivery_date,milestones[5]}`.
Django: MATCH (implemented).

### GET `…/resources/` — 200 `{project_id,total_artists,artists[{id,name,avatar?,role,task_count,hours_logged}],departments[]}` (mock derives from tasks).
Django: MATCH (implemented).

### GET `…/pipeline/` — 200 `{project_id,color_space,resolution,fps,aspect_ratio,pipeline_steps,dcc_integrations[4],usd_schema_version,ocio_config}`.
Django: MATCH (implemented).

### GET `…/files/?search=` — 200 paginated `MediaItem[]`. Django: MATCH (implemented).

### GET `…/activity/?search=` — 200 paginated activity rows. Django: MATCH (implemented).

---

## 11b. Shows (orphaned — no backend, no live caller)

`GET /api/v1/organizations/:oid/projects/:pid/shows`, `GET /api/v1/projects/:pid/shows`,
`GET /api/v1/shows/:sid` exist only in MSW (`handlers/showHandlers.ts:1-59`, dataset
`db/production/shows.ts`, 8 records); zero `mockRouter` coverage, zero `apiClient`
callers. No Django model or route. Tracked by
`docs/13-roadmap/show-production-context-epic.md` — do not implement ad-hoc.

## 12. Workflows / Automations / Scheduling

### GET|POST /api/v1/workflows/; GET|PATCH|PUT|DELETE /api/v1/workflows/{id}/;
POST `/{id}/simulate|clone|activate|deactivate|archive/`
Frontend: `WorkflowRepository (/api/v1/workflows)`, `WorkflowService.ts:33-52`.
Mock: `mockRouter.ts:4569-4838` (no MSW). Django: MATCH (verify `simulate` shape).

### GET|POST /api/v1/automations/rules/; PATCH|PUT|DELETE /rules/{id}/; GET /api/v1/automations/audit-logs/
Frontend: `WorkflowService.ts:57-74`. Mock: `mockRouter.ts:4845-4887`.
Django: stubs (`AutomationRulesView` etc.) — PARTIAL (verify shapes vs service).

### Scheduling — GET|POST /api/v1/scheduling/events/ (+detail, PATCH/PUT/DELETE);
GET /resources/ (+PATCH /{id}/); GET /capacity|overbooking|holidays|leaves/; POST /resolve-overbooking/ (`{alert_id,resource_id}`); POST /leaves/
Frontend: `SchedulingRepository.ts:13-64`. Mock: `mockRouter.ts:4896-5100`.
Django: `/api/v1/scheduling/events|resources|schedules|leaves|holidays/` exist — **MISMATCH paths**
(frontend expects flat `/api/v1/scheduling/<resource>/` for capacity/overbooking/leaves/resolve-overbooking;
verify exact caller URLs before adapting).

---

## 13. Adapter-only calls (no mock — direct network today)

- `GET /api/v1/projects/{id}/statistics/` → implement (see §2).
- `POST /api/v1/reviews/{id}/participant-verdict/` → implement (see §7).
- `GET /api/v1/organizations/all/` (`RESTOrganizationAdapter.getAll`), `POST /:id/archive|restore/`
  (`RESTOrganizationAdapter`) — adapter-only; backend has `archive/restore/switch/my/settings` actions
  under namespaced prefix; verify adapter compatibility, no new endpoint unless used by UI flows.
- `BaseRepository` generic `bulk/` + `bulk-delete/` — unused by real handlers; no action.
