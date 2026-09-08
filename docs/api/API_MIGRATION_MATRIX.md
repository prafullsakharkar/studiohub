# Frontend → Backend API Migration Matrix

Legend — Status: **Match** (reuse as-is) · **Mismatch** (adapt backend) · **Missing**
(implement) · **Extra** (backend-only, keep). All paths are frontend contract paths.

## Endpoint matrix

| Frontend Endpoint | Existing Backend | Status | Required Action |
|---|---|---|---|
| POST /api/v1/auth/login/ | `AuthLoginView` | Match | None |
| POST /api/v1/auth/refresh/ | `AuthRefreshView` | Match | None |
| POST /api/v1/auth/logout/ | `AuthLogoutView` | Match | None |
| GET /api/v1/auth/me/ | `AuthMeView` | Match | None |
| GET /api/v1/auth/memberships/ | — | Missing | New view (org memberships of user) |
| GET /api/v1/users/me/memberships/ | — | Missing | Alias of above |
| GET /api/v1/projects/ | `ProjectViewSet.list` | Mismatch | Add `client_name` search, `organization_id` filter |
| GET /api/v1/projects/{id}/ | `ProjectViewSet.retrieve` | Mismatch | Accept id-or-code lookup |
| POST /api/v1/projects/ | `ProjectViewSet.create` | Match | Verify required-field errors/defaults |
| PATCH/PUT /api/v1/projects/{id}/ | router | Match | None |
| DELETE /api/v1/projects/{id}/ | router | Match | None |
| GET /api/v1/projects/{id}/statistics/ | — | Missing | New `@action` (counts dict) |
| GET /api/v1/sequences/ | `SequenceViewSet.list` | Mismatch | Add `lead_artist` search, `include_deleted` |
| GET /api/v1/sequences/{id}/ | retrieve | Mismatch | id-or-code |
| POST /api/v1/sequences/ | create | Match | None |
| PATCH/PUT /api/v1/sequences/{id}/ | router | Match | None |
| DELETE /api/v1/sequences/{id}/ | destroy | Match | None |
| POST /api/v1/sequences/{id}/archive/ | — | Missing | New `@action` |
| POST /api/v1/sequences/{id}/restore/ | restore | Match | None |
| POST /api/v1/sequences/check-existence/ | `existence-check/` | Mismatch | Add alias (keep old) |
| POST /api/v1/sequences/bulk-create/ | bulk-create | Match | Verify response shape |
| POST /api/v1/sequences/bulk-update/ | bulk-update (PATCH) | Mismatch | Accept POST too |
| POST /api/v1/sequences/bulk-archive|restore/ | exist | Match | Verify shapes |
| GET /api/v1/shots/ | `ShotViewSet.list` | Mismatch | Add `sequence` alias, `include_deleted` |
| GET /api/v1/shots/{id}/ | retrieve | Mismatch | id-or-code |
| POST /api/v1/shots/ | create | Mismatch | Duplicate-code 409 (`EXISTS_SOFT_DELETED`) |
| PATCH/PUT /api/v1/shots/{id}/ | router | Match | None |
| DELETE /api/v1/shots/{id}/ | destroy | Match | None |
| POST /api/v1/shots/{id}/archive|restore/ | — | Missing | New actions |
| POST /api/v1/shots/{id}/approve/ | approve | Match | None |
| POST /api/v1/shots/check-existence/ | — | Missing | New (mirror sequences) |
| POST /api/v1/shots/bulk-*/(4) | — | Missing | New (mirror sequences) |
| GET /api/v1/assets/ | `AssetViewSet.list` | Mismatch | Add `include_archived` |
| GET /api/v1/assets/{id}/ | retrieve | Mismatch | id-or-code |
| POST/PATCH/PUT/DELETE assets | router | Match | None |
| POST /api/v1/assets/{id}/archive|restore/ | — | Missing | New actions |
| POST /api/v1/assets/check-existence/ | — | Missing | New |
| POST /api/v1/assets/bulk-*/(4) | — | Missing | New |
| GET/POST/PATCH/PUT/DELETE /api/v1/tasks/ | `TaskViewSet` | Mismatch | Add `assignee_id,vendor_id,team_id,include_archived` filters |
| POST /api/v1/tasks/{id}/archive|restore/ | — | Missing | New actions |
| POST /api/v1/tasks/check-existence/ | — | Missing | New |
| POST /api/v1/tasks/bulk-create|update/ | — | Missing | New |
| POST /api/v1/tasks/bulk-assign|status|archive|delete/ | exist | Match | None (shapes verified) |
| CRUD /api/v1/timelogs/ + approve/reject | `TimelogViewSet` | Match | Verify default date-desc ordering |
| CRUD /api/v1/reviews/ + 12 actions | `ReviewViewSet` | Match | Verify `client_only`, reviewer-name search |
| POST /api/v1/reviews/{id}/participant-verdict/ | — | Missing | New action |
| CRUD /api/v1/versions/ + publish/unpublish/archive/add-to-playlist | `VersionViewSet` | Match | Verify required-field errors |
| GET /api/v1/media/ (+detail/CUD) | `MediaViewSet` (bare array) | Match | None |
| GET /api/v1/attachments/ (+detail/C/D) | core `AttachmentViewSet` (paginated) | Mismatch | Bare-array compat alias at `/api/v1/attachments/` |
| GET /api/v1/playlists/ (+detail/CUD + 6 actions) | `PlaylistViewSet` (bare array) | Mismatch | Paginate list (keep actions) |
| GET /api/v1/organizations/ (+detail/CUD, PATCH status) | legacy (conditional pag.) | Match | None |
| GET /api/v1/departments|teams|offices/ (+detail/CUD) | legacy (bare array) | Match | None |
| GET /api/v1/people|clients|vendors/ (+detail/CUD, PATCH status) | legacy (paginated) | Match | Verify people archive via status |
| GET /api/v1/positions|invitations|work-calendars|work-hours|calendars|holidays|roles|groups|permissions|api-keys|pats/ (+detail/CUD, resend/revoke) | namespaced only (paginated) | Mismatch | Flat bare-array aliases |
| GET /api/v1/organization/ | singleton | Match | None |
| GET|PATCH /api/v1/billing/ | `BillingView` | Match | Verify shape |
| GET /api/v1/reports|notifications/ | stubs `[]` | Match | Verify callers accept `[]` |
| GET|POST /api/v1/audit/ | audit resource routes | Mismatch | Decide alias (backend read-only resources) |
| GET /api/v1/roles|permissions/ | (flat aliases) | Mismatch | Covered by flat aliases |
| GET /api/v1/analytics/kpis|departments/ | stubs | Match | Verify shapes |
| GET|PATCH /api/v1/settings/pipeline/ | — | Missing | Verify caller; stub if needed |
| Nested `/api/organizations/{org}/…` (17 resources) | — | Missing | Nested router reusing viewsets (per-resource pagination) |
| Project-scoped `/api/organizations/{org}/projects/{project}/…` (16) | — | Missing | New models (membership/editorial/note) + views |
| Workflows CRUD + 5 actions | `WorkflowViewSet` | Match | Verify `simulate` shape |
| Automations rules + audit-logs | stubs | Mismatch | Verify shapes vs service |
| Scheduling events/resources/… | `/api/v1/scheduling/…` | Mismatch | Verify exact caller URLs (capacity/overbooking/leaves/resolve) |

## Entity ↔ model comparison

| Frontend Entity | Backend Model | Fields | Rels | Actions | Verdict |
|---|---|---|---|---|---|
| Organization | `organization.Organization` | Compatible (verify tier/location/status) | — | CRUD+status | Reuse |
| User | `identity.User` + Profile | Compatible via `FrontendUser` serializer | memberships | auth only | Reuse |
| OrganizationMembership | `organization.OrganizationMembership` | Map role/permissions/status | user+org | list | Reuse + serializer |
| ProjectMembership | — | New | org+project+user | CRUD-ish | **Create model** |
| Project | `production.Project` | Compatible (+denormalized client/vendor) | org, client | CRUD | Reuse |
| Sequence | `production.Sequence` | Compatible | org+project | CRUD+bulk+archive | Reuse + actions |
| Shot | `production.Shot` | Compatible | org+project+seq | CRUD+bulk+approve | Reuse + actions |
| Asset | `production.Asset` | Compatible | org+project | CRUD+bulk | Reuse + actions |
| Task | `production.Task` | Compatible | org+project+assignee | CRUD+bulk | Reuse + actions |
| Timelog | `production.Timelog` | Compatible | task/project/person | CRUD+approve | Reuse |
| Version | `production.Version` | Compatible | multi-FK + JSON | CRUD+publish flow | Reuse |
| ReviewSession | `production.Review` | Compatible (JSON nests) | project | 14 actions | Reuse + 1 action |
| MediaItem | `production.Media` | Compatible | project+entity | CRUD | Reuse |
| AttachmentItem | `core.Attachment` | Partial (entity_link via metadata) | — | CRD | Reuse + alias |
| Playlist | `production.Playlist` | Compatible | project | CRUD+6 | Reuse + paginate |
| EditorialCut | — | New | org+project | read | **Create model** |
| ProjectNote | — | New | org+project+entity | CR | **Create model** |
| Department/Team/Office/Position | organization models | Compatible | org | CRUD | Reuse |
| Invitation | `organization.Invitation` | Map status values | org | CRUD+resend | Reuse + mapping |
| Client/Vendor (+contacts/contracts) | organization models | Compatible | org | CRUD+restore | Reuse |
| Person | `organization.Person` | Compatible | — | CRUD | Reuse |
| Role/Group/Permission/APIKey/PAT | organization models | Compatible | org/global | CRUD | Reuse |
| WorkCalendar/WorkHours/Calendar/Holiday | organization models | Compatible | org | CRUD | Reuse |
| DeliveryPackage | `deliveries.DeliveryPackage` | Compatible | org+project+client | CRUD+flow | Reuse |
| PublishItem | `publishing.PublishItem` | Compatible | org+project | CRUD+flow | Reuse (no apiClient use) |
| Workflow/Automation | `production.Workflow` + stubs | Compatible | org+project | CRUD+5 | Reuse |
| Scheduling resources/events/… | `scheduling.*` | Compatible | org | CRUD | Reuse |
| Audit/Activity | `audit.*` | Compatible | org | read | Reuse |
| Billing/Reports/Notifications | billing model + stubs | Verify | org | read | Reuse |

## Counts (initial)

- Total frontend endpoints discovered: ~150 (flat) + 16 project-scoped + ~60 nested-org = ~225 call shapes.
- Existing backend: ~200 routes. Status: ~170 Match · ~25 Mismatch · ~30 Missing (mostly nested/project-scoped aliases + 3 new models).
- Entities: ~35 discovered · 32 reuse · 3 create (`ProjectMembership`, `EditorialCut`, `ProjectNote`).
