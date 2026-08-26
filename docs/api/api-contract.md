# API Contract Inventory

Base URL: same-origin `/api/v1/` (the frontend sends relative paths; no `VITE_API_URL`
exists). All paths use trailing slashes; Django must tolerate both `/path` and `/path/`
(the mock router normalizes slashes, and some repositories send collection URLs without
one). See [versioning.md](versioning.md).

Legend for **Status**:
- `MATCHED` — frontend contract and backend route agree on path/method/shape.
- `MISMATCH` — both exist but path or shape differs (must be reconciled).
- `MISSING BACKEND` — frontend contract exists, no Django implementation.
- `MISSING FRONTEND` / `PLANNED` / `DEPRECATED` — see notes.

---

## 1. Authentication (`auth`)

Contract source: `modules/auth/services/AuthService.ts`, `core/auth/AuthProvider.tsx`.
Full details: [authentication.md](authentication.md) and [domains/identity.md](domains/identity.md).

| Method | Endpoint | Request | Response | Auth | Backend Route | Status |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login/` | `{email, password}` | `{tokens:{access, refresh}, user}` | none | `/api/v1/identity/login/` → `{access, refresh, session}` | MISMATCH |
| POST | `/api/v1/auth/refresh/` | `{refresh}` | `{access}` | none | `/api/v1/identity/refresh/` → `{access, refresh?, …}` | MISMATCH |
| POST | `/api/v1/auth/logout/` | – | `{detail}` | Bearer | `/api/v1/identity/logout/` | MISMATCH (path) |
| GET | `/api/v1/auth/me/` | – | `User` | Bearer | unrouted `MeAPIView` exists in `apps.identity.api.views.authentication` | MISMATCH |

The nested `tokens` wrapper is a hard frontend requirement
(`types/auth.ts` → `LoginResponse`). The backend login response must be adapted.

## 2. Identity (`identity`) — namespaced tree

Contract source: `modules/identity/api/{UserService,RoleService,PermissionService,SessionService,MFAService}.ts`.
Backend routes exist under `/api/v1/identity/…`.

| Group | Endpoints (prefix `/api/v1/identity/`) | Backend Status |
|---|---|---|
| Users | `GET/POST users/`, `GET/PUT/PATCH/DELETE users/{id}/`, `GET users/me/`, `POST users/{id}/{activate,deactivate,suspend,unsuspend,reset-password,force-password-change,revoke-sessions}/`, `GET/POST users/{id}/roles/` | Partial — `activate/deactivate/archive/restore/change_password` routed; `suspend/unsuspend/reset-password/force-password-change/revoke-sessions/roles` MISSING BACKEND |
| Roles | `GET/POST roles/`, CRUD `roles/{id}/`, `POST roles/{id}/clone/`, `GET/POST roles/{id}/permissions/`, `POST roles/{id}/permissions/{add,remove}/` | MISSING BACKEND (no Role viewset routed under identity; RBAC models live in organization app) |
| Permissions | `GET permissions/`, `/module/{module}/`, `/category/{category}/`, `/codes/` | Partial — `organization/permissions/` list is routed; module/category/codes filters need support |
| Sessions | `GET sessions/`, CRUD + `revoke-all/`, `revoke-other/` | MISSING BACKEND as routed endpoints (`UserSession` model exists; logout-all views exist but are unrouted) |
| MFA | `mfa/config/`, `mfa/totp/*`, `mfa/sms/*`, `mfa/email/*`, `mfa/recovery-codes*`, `mfa/admin/reset/{user_id}/` | MISMATCH — backend exposes `auth/mfa/{enroll,verify,disable,recovery,recovery/verify,devices,…}` under identity; paths differ from mock contract (`identityHandlers.ts` is currently dead code, so the *live* frontend does not yet call these) |

## 3. Organization — legacy flat contract

Contract source: `modules/organization/hooks/*`, `api/organizationApi.ts`. These are the
endpoints the current UI actually calls. **All are MISSING BACKEND at these exact paths**
(backend mounts equivalents under `/api/v1/organization/…`, see §4).

| Entity | Endpoints (prefix `/api/v1/`) | Pagination | Notes |
|---|---|---|---|
| Organizations | `GET/POST organizations/`, `GET/PATCH/PUT/DELETE organizations/{id}/` | Bare array unless `?page=`/`?page_size=` present, then `{count,next,previous,results}` | detail accepts id **or uppercase code**; nested `settings{…}` merged on PATCH |
| Clients | `GET/POST clients/`, CRUD `clients/{id}/` | paginated (default 15) | detail by id-or-code; requires `name` |
| Vendors | `GET/POST vendors/`, CRUD `vendors/{id}/` | paginated | specialization/security_tier/nda_signed/rating fields |
| People | `GET/POST people/`, CRUD `people/{id}/` | paginated | requires `full_name`+`email`; maps to `organization.Person` model (no API yet) |
| Departments | `GET departments/`, CRUD `departments/{id}/` | **bare array** | head/member_count/color/software_stack fields |
| Teams | `GET teams/`, CRUD `teams/{id}/` | **bare array** | department/lead/member_ids/current_project refs |
| Offices | `GET offices/`, CRUD `offices/{id}/` | **bare array** | holidays[], resources[], working_hours embedded |
| Billing singleton | `GET billing/` | object | StudioBilling shape |
| Reports | `GET reports/` | array | ProductionReport[] |
| Notifications | `GET notifications/` | array | also consumed via platform tree below |
| Org singleton | `GET organization/` | object | legacy dashboard bootstrap |

## 4. Organization — namespaced v2 contract

Contract source: `modules/organization/api/{OrganizationService,DepartmentService,TeamService,OfficeService,MembershipService,InvitationService}.ts`
(`new ApiClient('/api/v1')` + `/organization/…`). These match the backend mount point.

| Resource | Endpoints (prefix `/api/v1/organization/`) | Backend Status |
|---|---|---|
| Organizations | CRUD `organizations/` (+ actions `archive/ restore/ export/ switch/ settings/`) | MISMATCH — CRUD MATCHED; custom actions MISSING BACKEND |
| Departments | CRUD `departments/` | MATCHED (list/detail/create/update/delete) |
| Teams | CRUD `teams/` | MATCHED |
| Offices | CRUD `offices/` | MATCHED |
| Memberships | `memberships/` + `members/add/ remove/ transfer-ownership/` | MISMATCH — memberships routed; member actions MISSING BACKEND |
| Invitations | `invitations/` CRUD | MATCHED (accept/revoke actions to confirm against service calls) |

Backend extras already routed but not yet consumed by the frontend (MISSING FRONTEND):
`brandings/ calendars/ holidays/ work-calendars/ work-hours/ positions/ api-keys/
personal-access-tokens/ groups/ roles/ permissions/ user-roles/ group-members/
group-roles/ role-permissions/ organization-settings/`.

## 5. Production

**Entirely MISSING BACKEND.** No production app/models exist; every endpoint below is a
frontend contract implemented only by mocks. Full field-level contracts:
[domains/production.md](domains/production.md).

| Entity | Endpoints (prefix `/api/v1/`) | Pagination |
|---|---|---|
| Projects | CRUD `projects/` | paginated (default 10); search name/code/description/client_name |
| Shots | CRUD `shots/` + `POST shots/{id}/approve/` | paginated |
| Assets | CRUD `assets/` | paginated |
| Tasks | CRUD `tasks/` + `POST tasks/bulk-{assign,status,archive,delete}/` | paginated; MSW-only bulk ops (mockRouter misses them) |
| Timelogs | CRUD `timelogs/` + `POST {id}/{approve,reject}/` | paginated |
| Versions | CRUD `versions/` + `POST {id}/{publish,unpublish,archive,add-to-playlist,promote}/` | paginated; **two divergent mock shapes** (`PublishedVersion` MSW vs `ProductionVersion` router) — must reconcile before implementing |
| Reviews | CRUD `reviews/` + `POST {id}/{submit,start-review,approve,reject,request-changes,close,verdict,annotations,comments,notes}/`, `comments/{cid}/{resolve,reopen}/` | paginated list |
| Media | CRUD `media/` | **bare array** |
| Attachments | `GET/POST/DELETE attachments/`, `GET attachments/{id}/` | **bare array** (backend has `/api/v1/core/attachments/` — different path) |
| Playlists | CRUD `playlists/` + `POST {id}/{add-entry,remove-entry,reorder,share,archive,restore}/` | **bare array** |
| Workflows | CRUD `workflows/` + `POST {id}/{simulate,clone,activate,deactivate,archive}/` | paginated (default 10) |
| Automations | CRUD `automations/rules/`, `GET automations/audit-logs/` | bare array |
| Scheduling | `scheduling/{events,resources,capacity,overbooking,holidays,leaves}/` + `POST scheduling/resolve-overbooking/` | bare arrays |
| Analytics | `GET analytics/kpis/`, `GET analytics/departments/` | objects/array |

## 6. Settings

Frontend (`modules/settings/api/SettingsService.ts`) calls:

| Endpoint | Backend Status |
|---|---|
| `GET/PATCH /api/v1/settings/settings/` (+`bulk-update/`, `?category=`) | MISMATCH — backend exposes `categories/ definitions/ feature-flags/ themes/ localizations/ system-settings/ organization-settings/`; no aggregated `settings/` resource |
| `POST /api/v1/settings/feature-flags/{key}/{enable,disable}/` | MISMATCH — backend uses `{pk}/enable|disable/` (key lookup needed) |
| `GET/PATCH /api/v1/settings/pipeline/` | MISSING BACKEND (PipelineSettings mock singleton; candidate: organization/system settings) |
| `GET /api/v1/settings/system/`, `/settings/organizations/{orgId}/settings/` | MISMATCH — backend has `system-settings/`, `organization-settings/` resources |

## 7. Platform (billing/reports/notifications/webhooks/whitelabel)

All under `/api/v1/platform/…`: `analytics/export/ dashboards/ kpis/ reports/
report-schedules/ report-generations/{id}/download/{format}/ billing/{subscription,usage,
invoices,payments,plans}/ notifications/... webhooks/ notification-templates/
delivery-logs/ whitelabel/{branding,theme,domains,email-branding,login-page}/`.
**MISSING BACKEND entirely** — no app exists; treat as PLANNED (document contract only;
do not implement until prioritized).

## 8. Audit

| Frontend Endpoint | Backend Route | Status |
|---|---|---|
| `GET/POST /api/v1/audit/` | `/api/v1/audit/audit-logs/` (read-only) | MISMATCH — path differs; POST not allowed by backend |
| `GET /audit/logs/{id}/`, `POST /audit/logs/export/` | missing | MISSING BACKEND |

## 9. Core

| Frontend Endpoint | Backend Route | Status |
|---|---|---|
| `GET /healthz` style checks | `GET /health/` (outside `/api/`) | MATCHED (unused by frontend today) |
| `attachments/` (production-style) | `/api/v1/core/attachments/` | Path mismatch — decide canonical location in production phase |
| tags | `/api/v1/core/tags/` | MISSING FRONTEND (routed, unused) |

## 10. Conventions Summary

- **IDs:** string UUIDs expected by mocks (`usr-001` etc.) — real backend uses UUID PKs;
  serializers must expose string `id`.
- **Denormalized display fields:** mocks return `*_id` + `*_name` pairs
  (`assignee_id`/`assignee_name`, `department_id`/`department_name`, …). Serializers must
  include these read-only display fields to avoid UI rewrites.
- **Filtering:** unknown query params do case-insensitive exact match in mocks; real
  FilterSets must declare each supported param explicitly ([filtering.md](filtering.md)).
- **Search:** `?search=` case-insensitive substring over declared fields.
- **Ordering:** `?ordering=-field` Django syntax.
- **Errors:** DRF shapes (`detail`, `non_field_errors`, `{field: [msg]}`)
  ([errors.md](errors.md)).
