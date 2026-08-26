# Frontend → Backend Mapping (Integration Checklist)

Primary integration checklist. Statuses: `MATCHED` · `MISMATCH` · `MISSING BACKEND` ·
`MISSING FRONTEND` · `PLANNED` · `DEPRECATED`.

## Authentication

| Frontend API | MSW Source | Django Endpoint | Backend App | Status |
|---|---|---|---|---|
| `POST /api/v1/auth/login/` | router+handler | `/api/v1/identity/login/` | identity | MISMATCH |
| `POST /api/v1/auth/refresh/` | router+handler | `/api/v1/identity/refresh/` | identity | MISMATCH |
| `POST /api/v1/auth/logout/` | router+handler | `/api/v1/identity/logout/` | identity | MISMATCH |
| `GET /api/v1/auth/me/` | router+handler | unrouted `MeAPIView` | identity | MISMATCH |

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
| v2: organizations CRUD | router+handler | `organization/organizations/` | organization | MATCHED |
| v2: org archive/restore/export/switch/settings | router only | — | organization | MISSING BACKEND |
| v2: departments/teams/offices CRUD | handler | routed viewsets | organization | MATCHED |
| v2: memberships CRUD | router | routed | organization | MATCHED |
| v2: members/add, remove, transfer-ownership | router | — | organization | MISSING BACKEND |
| v2: invitations CRUD | router | routed | organization | MATCHED |
| legacy: `/organizations/` flat (conditional pagination, id-or-code) | router+handler | — | organization | MISSING BACKEND |
| legacy: `/clients/`, `/vendors/` CRUD | router+handler | — | — | MISSING BACKEND (missing models too) |
| legacy: `/people/` CRUD | router+handler | model exists, no API | organization | MISSING BACKEND |
| legacy: `/departments/ /teams/ /offices/` flat bare-array | router+handler | namespaced routes only | organization | MISSING BACKEND (aliases) |
| legacy: `/billing/ /reports/ /notifications/ /organization/` | router+handler | — | — | MISSING BACKEND |

## Production

All **MISSING BACKEND** (no app/models). MSW source column shows where the contract lives.

| Frontend API | MSW Source | Status |
|---|---|---|
| projects CRUD | router+handler | MISSING BACKEND |
| shots CRUD + approve | router+handler | MISSING BACKEND |
| assets CRUD | router+handler | MISSING BACKEND |
| tasks CRUD | router+handler | MISSING BACKEND |
| tasks bulk-assign/status/archive/delete | **MSW only** | MISSING BACKEND |
| timelogs CRUD + approve/reject | router+handler | MISSING BACKEND |
| versions CRUD + publish/unpublish/archive/add-to-playlist | router (rich) vs handler (flat) | MISSING BACKEND + **contract divergence** |
| versions promote | **MSW only** | MISSING BACKEND |
| reviews list/detail + lifecycle actions + annotations/comments/notes | router+4 handlers | MISSING BACKEND |
| media CRUD | router only | MISSING BACKEND |
| attachments (production paths) | router only | MISSING BACKEND (core attachments exist at different path → MISMATCH) |
| playlists CRUD + entry/share actions | router only | MISSING BACKEND |
| workflows CRUD + simulate/clone/activate/deactivate/archive | router only | MISSING BACKEND |
| automations rules CRUD, audit-logs | router only | MISSING BACKEND |
| scheduling events/resources/capacity/overbooking/holidays/leaves | router only | MISSING BACKEND |
| analytics kpis/departments | router+handler | MISSING BACKEND |

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
| production-style `attachments/` | `core/attachments/` | MISMATCH (path) |
| tags | `core/tags/` routed | MISSING FRONTEND |

## Mock Data → Real Model Map (summary)

| Mock dataset | Django model | Status |
|---|---|---|
| identity/users.ts | identity.User | exists |
| organization.ts (orgs, depts, teams, offices) | organization.* | exists |
| organization Person | organization.Person | model exists |
| Clients/Vendors, StudioBilling, Reports, Notifications | — | MISSING MODELS |
| projects/shots/assets/tasks/versions/reviews/playlists/media/workflows/scheduling fixtures | — | MISSING MODELS (design per docs/03-domain/) |
| audit logs | audit.AuditLog | exists |
| pipeline settings singleton | settings.SystemSetting/OrganizationSetting | partial fit |
| intelligence datasets | — | not REST-exposed; no backend target |

## Counts

- Frontend-called endpoints inventoried: ~150 distinct method/path pairs.
- MATCHED: ~25 (identity users core + organization v2 CRUD).
- MISMATCH: ~12 (auth tree, settings tree, audit, attachments path, permissions filters).
- MISSING BACKEND: ~110 (all of production, legacy organization aliases, identity
  extensions, platform).
- MISSING MODELS: ~22 entities (see domains/production.md §13 and above).
