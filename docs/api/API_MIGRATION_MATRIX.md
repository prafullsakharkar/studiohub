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
| GET /api/v1/auth/memberships/ | `AuthMembershipsView` | Match | None (mock-only routes, no caller) |
| GET /api/v1/users/me/memberships/ | alias | Match | None |
| GET /api/v1/projects/ | `ProjectViewSet.list` | Match | `client_name` search + `organization_id` filter added 2026-09-10 |
| GET /api/v1/projects/{id}/ | `ProjectViewSet.retrieve` | Match | id-or-code lookup |
| POST /api/v1/projects/ | `ProjectViewSet.create` | Match | Verify required-field errors/defaults |
| PATCH/PUT /api/v1/projects/{id}/ | router | Match | None |
| DELETE /api/v1/projects/{id}/ | router | Match | None |
| GET /api/v1/projects/{id}/statistics/ | `ProjectViewSet.statistics` | Match | None |
| GET /api/v1/sequences/ | `SequenceViewSet.list` | Mismatch | Add `lead_artist` search, `include_deleted` |
| GET /api/v1/sequences/{id}/ | retrieve | Mismatch | id-or-code |
| POST /api/v1/sequences/ | create | Match | None |
| PATCH/PUT /api/v1/sequences/{id}/ | router | Match | None |
| DELETE /api/v1/sequences/{id}/ | destroy | Match | None |
| POST /api/v1/sequences/{id}/archive/ | `archive` action | Match | None |
| POST /api/v1/sequences/{id}/restore/ | restore | Match | None |
| POST /api/v1/sequences/check-existence/ | `check-existence/` + legacy `existence-check/` | Match | None |
| POST /api/v1/sequences/bulk-create/ | bulk-create | Match | Verify response shape |
| POST /api/v1/sequences/bulk-update/ | bulk-update (POST+PATCH) | Match | None |
| POST /api/v1/sequences/bulk-archive|restore/ | exist | Match | Verify shapes |
| GET /api/v1/shots/ | `ShotViewSet.list` | Match | `sequence` alias added 2026-09-10; `include_deleted` global |
| GET /api/v1/shots/{id}/ | retrieve | Match | id-or-code |
| POST /api/v1/shots/ | create | Match | Duplicate-code 409 handled |
| PATCH/PUT /api/v1/shots/{id}/ | router | Match | None |
| DELETE /api/v1/shots/{id}/ | destroy | Match | None |
| POST /api/v1/shots/{id}/archive|restore/ | actions | Match | None |
| POST /api/v1/shots/{id}/approve/ | approve | Match | None |
| POST /api/v1/shots/check-existence/ | check-existence | Match | None |
| POST /api/v1/shots/bulk-*/(4) | bulk actions | Match | None |
| GET /api/v1/assets/ | `AssetViewSet.list` | Match | `include_archived` supported |
| GET /api/v1/assets/{id}/ | retrieve | Match | id-or-code |
| POST/PATCH/PUT/DELETE assets | router | Match | None |
| POST /api/v1/assets/{id}/archive|restore/ | actions | Match | None |
| POST /api/v1/assets/check-existence/ | check-existence | Match | None |
| POST /api/v1/assets/bulk-*/(4) | bulk actions | Match | None |
| GET/POST/PATCH/PUT/DELETE /api/v1/tasks/ | `TaskViewSet` | Match | `project_id,team_id,assignee_id,vendor_id` aliases added 2026-09-10; `project_id` also resolves codes + mock ids (`proj-001`→`NK99`, fail-closed); `show_id` accepted-but-unscoped until Show epic |
| POST /api/v1/tasks/{id}/archive|restore/ | actions | Match | None |
| POST /api/v1/tasks/check-existence/ | check-existence | Match | None |
| POST /api/v1/tasks/bulk-create|update/ | bulk actions | Match | None |
| POST /api/v1/tasks/bulk-assign|status|archive|delete/ | exist | Match | None (shapes verified) |
| CRUD /api/v1/timelogs/ + approve/reject | `TimelogViewSet` | Match | Verify default date-desc ordering |
| CRUD /api/v1/reviews/ + 13 actions | `ReviewViewSet` | Match | No `client_only` (Playlist field; no caller) |
| POST /api/v1/reviews/{id}/participant-verdict/ | action | Match | None |
| CRUD /api/v1/versions/ + publish/unpublish/archive/add-to-playlist | `VersionViewSet` | Match | Verify required-field errors |
| GET /api/v1/media/ (+detail/CUD) | `MediaViewSet` (bare array) | Match | None |
| GET /api/v1/attachments/ (+detail/C/D) | core `AttachmentViewSet` (paginated) | Mismatch | Bare-array compat alias at `/api/v1/attachments/` |
| GET /api/v1/playlists/ (+detail/CUD + 6 actions) | `PlaylistViewSet` (bare array) | Mismatch | Paginate list (keep actions) |
| GET /api/v1/organizations/ (+detail/CUD, PATCH status) | legacy (conditional pag.) | Match | Create/update accept Title Case status (`Active`/`Archived`) via `CaseInsensitiveChoiceField`, stored lowercase |
| GET /api/v1/departments|teams|offices/ (+detail/CUD) | legacy (bare array) | Match | None |
| GET /api/v1/people|clients|vendors/ (+detail/CUD, PATCH status) | legacy (paginated) | Match | Verify people archive via status |
| GET /api/v1/positions|invitations|work-calendars|work-hours|calendars|holidays|roles|groups|permissions|api-keys|pats/ (+detail/CUD, resend/revoke) | flat `Compat*` bare-array aliases | Match | None |
| GET /api/v1/organization/ | singleton | Match | None |
| GET|PATCH /api/v1/billing/ | `BillingView` | Match | Verify shape |
| GET /api/v1/reports|notifications/ | stubs `[]` | Match | Verify callers accept `[]` |
| GET /api/v1/audit/ | flat list-only alias (`audit-flat-list`, frontend shape) | Match | Added 2026-09-10; POST stays unrouted (append-only) |
| GET /api/v1/roles|permissions/ | (flat aliases) | Mismatch | Covered by flat aliases |
| GET /api/v1/analytics/kpis|departments/ | stubs | Match | Verify shapes |
| GET|PATCH /api/v1/settings/pipeline/ | — (mock-only, no caller) | Match (intentionally absent) | None unless a caller lands |
| Nested `/api/organizations/{org}/…` (17 resources) | nested router | Match | None |
| Project-scoped `/api/organizations/{org}/projects/{project}/…` (16) | project-scoped views | Match | None |
| Workflows CRUD + 5 actions | `WorkflowViewSet` | Match | Verify `simulate` shape |
| Automations rules + audit-logs | stubs | Mismatch | Verify shapes vs service |
| Scheduling events/resources/… | `/api/v1/scheduling/…` | Mismatch | Verify exact caller URLs (capacity/overbooking/leaves/resolve) |

## Entity ↔ model comparison

| Frontend Entity | Backend Model | Fields | Rels | Actions | Verdict |
|---|---|---|---|---|---|
| Organization | `organization.Organization` | Compatible (verify tier/location/status) | — | CRUD+status | Reuse |
| User | `identity.User` + Profile | Compatible via `FrontendUser` serializer | memberships | auth only | Reuse |
| OrganizationMembership | `organization.OrganizationMembership` | Map role/permissions/status | user+org | list | Reuse + serializer |
| ProjectMembership | `production.ProjectMembership` | Compatible | org+project+user | CRUD-ish | Reuse (created 2026-09-08) |
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
| EditorialCut | `production.EditorialCut` | Compatible | org+project | read | Reuse (created 2026-09-08) |
| ProjectNote | `production.ProjectNote` | Compatible | org+project+entity | CR | Reuse (created 2026-09-08) |
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

## Counts (re-verified 2026-09-10)

- Frontend call shapes: ~120 organizationApi call-sites · 16 project-scoped (+`members` MSW-only) · ~120 production flat ops · 4 auth · scheduling/workflows/automations/audit/analytics/settings/billing misc. 3 MSW-only orphaned show routes (no caller, no backend — see Show epic).
- Backend: all inventoried contract paths implemented. Remaining intentional non-matches: `settings/pipeline/` (no caller), review `client_only`/reviewer-name search (no caller), flat `audit/` POST (append-only), playlists/roles/permissions mock-side shape bugs (frontend-owned, backend follows typed contract).
- Entities: ~40 discovered · all reuse existing models · 0 to create (the 3 former creates landed 2026-09-08). Model-less by design (stubs): reports, notifications, automation rules/logs, scheduling aggregates. No `Show` model — see Show epic.
