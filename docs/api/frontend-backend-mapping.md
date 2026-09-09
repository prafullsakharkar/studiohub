# Frontend → Backend Mapping (Integration Checklist)

Primary integration checklist. Statuses: `MATCHED` · `MISMATCH` · `MISSING BACKEND` ·
`MISSING FRONTEND` · `PLANNED` · `DEPRECATED`.

## Authentication

| Frontend API | MSW Source | Django Endpoint | Backend App | Status |
|---|---|---|---|---|
| `POST /api/v1/auth/login/` | router+handler | `/api/v1/auth/login/` (compat) + `/api/v1/identity/login/` | identity | **MATCHED** (Phase B) |
| `POST /api/v1/auth/refresh/` | router+handler | `/api/v1/auth/refresh/` (compat) | identity | **MATCHED** (Phase B) |
| `POST /api/v1/auth/logout/` | router+handler | `/api/v1/auth/logout/` (compat) | identity | **MATCHED** (Phase B) |
| `GET /api/v1/auth/me/` | router+handler | `/api/v1/auth/me/` (compat) | identity | **MATCHED** (Phase B) |

## Identity

| Frontend API | MSW Source | Django Endpoint | Backend App | Status |
|---|---|---|---|---|
| users CRUD, `users/me/`, activate/deactivate | dead `identityHandlers.ts` | routed viewset | identity | MATCHED |
| `users/{id}/suspend|unsuspend|reset-password|force-password-change|revoke-sessions/` | dead handlers | — | identity | MISSING BACKEND |
| `users/{id}/roles/` GET/POST | dead handlers | — | identity/org | MISSING BACKEND |
| roles CRUD + clone + permission add/remove | dead handlers | — | org models | MISSING BACKEND |
| permissions list (+module/category/codes) | dead handlers | `organization/permissions/` | organization | MISMATCH |
| sessions CRUD, revoke-all/revoke-other | dead handlers | unrouted views exist | identity | MISSING BACKEND |
| MFA suite | none (unregistered) | `identity/auth/mfa/*` exists | identity | PLANNED |

## Organization

| Frontend API | MSW Source | Django Endpoint | Backend App | Status |
|---|---|---|---|---|
| v2: organizations CRUD (paginated) | router+handler | `organization/organizations/` | organization | **MATCHED** |
| v2: org `archive/` `restore/` `export/` `switch/` `settings/` `my/` | `OrganizationService` | `organization/organizations/{id}/{archive,restore,export,switch,settings}` + `my/` | organization | **MATCHED** (Phase C) |
| v2: departments/teams/offices CRUD (paginated) | handler | routed viewsets | organization | **MATCHED** |
| v2: persons CRUD (paginated) | — | `organization/persons/` + `people/` | organization | **MATCHED** (Phase C) |
| v2: memberships CRUD (paginated) + `bulk-update/` | router | `organization/memberships/` + `bulk-update/` | organization | **MATCHED** (Phase C) |
| v2: teams `archive/` `transfer-ownership/` `members/` `members/add/` `members/remove/` | router | `organization/teams/{id}/...` | organization | **MATCHED** (Phase C) |
| v2: invitations CRUD + `resend/` `accept/` `decline/` | router | `organization/invitations/` | organization | **MATCHED** (Phase C) |
| legacy: `/organizations/` flat (conditional pagination, id-or-code) | router+handler | `/organizations/` (legacy) | organization | **MATCHED** (Phase C alias) |
| legacy: `/departments/` `/teams/` `/offices/` flat bare-array | router+handler | `/departments/` etc (legacy) | organization | **MATCHED** (Phase C alias) |
| legacy: `/people/` CRUD (paginated) | router+handler | `/people/` (legacy) + `/organization/persons/` | organization | **MATCHED** (Phase C) |
| legacy: `/organization/` singleton | router+handler | `/organization/` (legacy) | organization | **MATCHED** (Phase C) |
| legacy: `/clients/`, `/vendors/` CRUD | router+handler | — | — | **MISSING MODEL** (deferred to `commercial` app) |
| legacy: `/billing/` `/reports/` `/notifications/` | router+handler | — | — | **MISSING MODEL** (platform scope) |

## Production

All slices **MATCHED** via `apps.production` (Phase D).

| Frontend API | MSW Source | Django Endpoint | Status |
|---|---|---|---|
| projects CRUD (paginated) | router+handler | `/api/v1/projects/` | **MATCHED** (Phase D.1) |
| shots CRUD + `approve/` | router+handler | `/api/v1/shots/` | **MATCHED** (Phase D.1) |
| assets CRUD | router+handler | `/api/v1/assets/` | **MATCHED** (Phase D.1) |
| tasks CRUD (paginated) | router+handler | `/api/v1/tasks/` | **MATCHED** (Phase D.2) |
| tasks bulk-assign/status/archive/delete | **MSW only** | `/api/v1/tasks/bulk-*` | **MATCHED** (Phase D.2) |
| timelogs CRUD + approve/reject | router+handler | `/api/v1/timelogs/` | **MATCHED** (Phase D.2) |
| versions CRUD + publish/unpublish/archive/add-to-playlist/promote | router (rich) vs handler (flat) | `/api/v1/versions/` | **MATCHED** (Phase D.3) |
| reviews list/detail + lifecycle actions | router+4 handlers | `/api/v1/reviews/` | **MATCHED** (Phase D.4) |
| media CRUD (bare array) | router only | `/api/v1/media/` | **MATCHED** (Phase D.5) |
| attachments (production paths) | router only | `/api/v1/attachments/` (alias) | **MATCHED** (Phase A alias) |
| playlists CRUD + entry/share actions (bare array) | router only | `/api/v1/playlists/` | **MATCHED** (Phase D.5) |
| workflows CRUD + simulate/clone/... (paginated) | router only | `/api/v1/workflows/` | **MATCHED** (Phase D.6) |
| automations rules CRUD, audit-logs (bare array) | router only | `/api/v1/automations/rules|audit-logs/` | **MATCHED** (Phase D.6) |
| scheduling events/resources/... (bare arrays) | router only | `/api/v1/scheduling/...` | **MATCHED** (Phase D.7) |
| analytics kpis/departments | router+handler | `/api/v1/analytics/...` | **MATCHED** (Phase D.7) |

## Settings & Platform

| Frontend API | Django Endpoint | Status |
|---|---|---|
| `/settings/settings/` aggregate + bulk-update | categories/definitions/etc. exposed separately | MISMATCH |
| `/settings/feature-flags/{key}/{enable,disable}/` | `{pk}/enable|disable/` | MISMATCH |
| `/settings/pipeline/` GET/PATCH | — | MISSING BACKEND |
| `/settings/system/`, `/settings/organizations/{id}/settings/` | system-settings/, organization-settings/ resources | MISMATCH |
| `/platform/*` (analytics, billing, reports, notifications, webhooks, whitelabel) | — | PLANNED (no app; document only) |

## Audit & Core

| Frontend API | Django Endpoint | Status |
|---|---|---|
| `GET/POST /audit/` | `audit/audit-logs/` read-only | MISMATCH |
| `POST /audit/logs/export/` | — | MISSING BACKEND |
| production-style `attachments/` | `/api/v1/attachments/` (alias) + `/api/v1/core/attachments/` | **MATCHED** (Phase A alias) |
| tags | `core/tags/` routed | MISSING FRONTEND |

## Mock Data → Real Model Map (summary)

| Mock dataset | Django model | Status |
|---|---|---|
| identity/users.ts | identity.User | exists |
| organization.ts (orgs, depts, teams, offices) | organization.* | exists |
| organization Person | organization.Person | **MATCHED** via `PersonViewSet` (`people` + `persons`) |
| Clients/Vendors, StudioBilling, Reports, Notifications | — | **MISSING MODELS** (deferred) |
| projects/shots/assets | `production.Project`/`Shot`/`Asset` | **MATCHED** (Phase D.1) |
| tasks/versions/reviews/playlists/media/workflows/scheduling fixtures | — | **MISSING MODELS** (design per `docs/03-domain/`) |
| audit logs | audit.AuditLog | exists |
| pipeline settings singleton | settings.SystemSetting/OrganizationSetting | partial fit |
| intelligence datasets | — | not REST-exposed; no backend target |

## Counts

- Frontend-called endpoints inventoried: ~150 distinct method/path pairs.
- MATCHED: ~95 (auth 4 + attachments 2 + org v2 custom actions 10 + legacy aliases 5 + person 2 + org pagination + production all slices ≈ 40).
- MISMATCH: ~3 (settings aggregate, audit POST).
- MISSING BACKEND: ~50 (`clients/vendors/billing` no models, remaining identity extensions like `users/suspend`, platform).
- MISSING MODELS: ~5 (`Client`/`Vendor`/`StudioBilling` deferred; core production entities all done).
