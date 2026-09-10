# StudioHub Django API (Real API)

Base: same-origin `/api/` (dev: `http://localhost:8000`). Versioned root `/api/v1/`
plus unversioned nested scopes `/api/organizations/…`.

Global contract (all endpoints):

- **Auth**: `Authorization: Bearer <access>` (SimpleJWT; refresh rotation).
  Login/refresh are `AllowAny`; everything else requires authentication.
- **Organization scope**: `X-Organization-Id` (or `X-Organization`) header.
  Resolved server-side to org + membership; client-supplied org ids in bodies
  are ignored for scoping. No context → fail closed (400/403/empty).
- **Pagination**: `?page=&page_size=` (`limit` alias); envelope
  `{count,next,previous,results}`. Endpoints marked `RAW[]` return bare arrays.
- **Filtering**: `?search=` (icontains OR over endpoint fields); other params exact
  match via FilterSets; `?ordering=field|-field`. `?include_deleted` /
  `?include_archived` opts soft-deleted rows back into production lists.
- **Detail lookup**: UUID id or `code` (case-insensitive) on code-bearing entities.
- **Errors**: `{detail}`, `{non_field_errors:[]}`, `{field:[msg]}`; 400/401/403/
  404 `{detail}`/409/422; 204 empty.
- **Bulk union envelope** (sequences/shots/assets/tasks): responses carry BOTH
  the frontend `BulkOperationResponse`
  (`operation_id,timestamp,summary{total,…,createdCount,updatedCount,
  archivedCount,restoredCount,recoveredCount,skippedCount,failedCount},
  results[{index,code,success,actionTaken,entity?,error?,suggestedAction?}],
  partial_success`) AND legacy keys (`processed,successful,failed`,
  `results[].status`). `check-existence/` returns `{items:[{code,state:
  NEW|EXISTS|SOFT_DELETED|DUPLICATE_IN_REQUEST|INVALID,existing_entity?,
  message?}], results:[{index,status,…}]}`; legacy path `existence-check/`
  kept. `bulk-update/` accepts POST+PATCH, `{ids,changes}` or legacy
  `[{id,…}]`. `bulk-archive|restore/` accept `{ids}` (+`task_ids` alias) and
  return `summary.archivedCount|restoredCount` plus `success,updated_count`.

## Auth `/api/v1/auth/`

| Method | Path | Notes |
|---|---|---|
| POST | `/login/` | `{email,password}` → `{tokens:{access,refresh},user}` |
| POST | `/refresh/` | `{refresh}` → `{access}` |
| POST | `/logout/` | → `{detail}` |
| GET | `/me/` | → `FrontendUser` |
| GET | `/memberships/` | → `OrganizationMembership[]` (frontend shape) |
| GET | `/users/me/memberships/` | alias of above |

## Production `/api/v1/`

CRUD = `GET+POST /`, `GET+PUT+PATCH+DELETE /{id}/` (id-or-code). All org-scoped.

| Prefix | Filters/search | Actions |
|---|---|---|
| `projects/` | search name/code/description/client_name; `organization_id` accepted (server-resolved, fail-closed) | `GET {id}/statistics/` → counts dict |
| `sequences/` | search code/name/description/department/lead_artist_name | `check-existence/`, `bulk-create|update|archive|restore/`, `{id}/archive|restore/`, `GET archived/` |
| `shots/` | `sequence` (=`sequence_code`) alias, `include_deleted` | same set + `{id}/approve/` |
| `assets/` | `include_archived` | same set (no approve) |
| `tasks/` | `project_id` (UUID/code/mock-id via `ProjectSelector.resolve_by_lookup`, fail-closed), `team_id/assignee_id` (tolerant UUID, garbage→empty, never 400), `vendor_id` iexact, entity/is_archived; `show_id` accepted but not yet scoped (no Show model — see Show epic) | same set + `bulk-assign|status|delete/` (`{success,updated_count}`) |
| `timelogs/` | date-desc default | `{id}/approve|reject/` |
| `versions/` | entity/status/published | `publish|unpublish|archive|promote|add-to-playlist/` |
| `reviews/` | search title/code/entity_code (no `client_only` — Playlist field) | `submit|start-review|approve|reject|request-changes|close|verdict|annotations|comments|comments/{cid}/resolve|reopen|notes|participant-verdict/` |
| `media/` | RAW[] bare array; search title/code/file_name/name/file_format/category | CRUD |
| `playlists/` | paginated | `add-entry|remove-entry|reorder|share|archive|restore/` |
| `workflows/` | — | `simulate|clone|activate|deactivate|archive/` |
| `automations/rules/` etc. | stubs (bare) | — |
| `scheduling/capacity|overbooking|resolve-overbooking/` | stubs | — |
| `analytics/kpis|departments/` | stubs | — |

## Organizations

Flat `/api/v1/` (legacy aliases): `organizations/` (array unless page params),
`departments|teams|offices/` (RAW[]), `people|clients|vendors/` (paginated),
`positions|invitations|work-calendars|work-hours|calendars|holidays|roles|
groups|permissions|api-keys|pats/` (RAW[]), `organization/` singleton,
`billing/` (GET|PATCH), `reports|notifications/` (stubs). Detail id-or-code.
Status-word mapping on update: invitations `Revoked→cancelled` (output
`Pending|Accepted|Expired|Revoked`); api-keys/pats `status↔is_active`
(output `Active|Revoked`). Invitations keep `resend|accept|decline/`.

Namespaced `/api/v1/organization/<resource>/` (paginated, full RBAC): unchanged.

Nested `/api/organizations/<org>/<resource>/` (no `/v1/`, trailing slash
optional; `<org>` = id/code/slug/mock-id like `org-apex-01`, wins over header):
same 17 resources with contract pagination (clients/vendors/people paginated,
rest RAW[]).

## Project-scoped `/api/organizations/<org>/projects/<project>/…`

`<project>` = id/code. Authenticated org/project members (403 otherwise);
cross-org ids 404. Lists paginated with flat-endpoint shapes/filters.

`members` (GET `{count,results}` + POST 201/200) · `summary` (project+counts) ·
`sequences|shots|tasks|assets|versions|reviews|editorial|deliveries|files|
activity` (GET) · `notes` (GET+POST 201) · `schedule` (5 interpolated
milestones) · `resources` (task-derived artists/departments) · `pipeline`
(project fields + workflow nodes + contractual DCC constants).

## Scheduling `/api/v1/scheduling/`

`events|resources|schedules|leaves|holidays/` — RAW[] bare-array lists (frontend
contract), full CRUD + `events/{id}/update-status/`, `resources/{id}/book|block/`,
`leaves/{id}/approve|reject/`. Capacity/overbooking/resolve/holidays/leaves
aggregate stubs return `[]` / `{success,message}` shapes.

## Other domains (unchanged, verified compatible)

`/api/v1/identity/` (users/sessions/MFA), `/api/v1/deliveries/`
(+`add-version|validate|prepare|submit|approve|reject|complete|cancel/`),
`/api/v1/publishing/` (+`validate|republish|unpublish|retry/`),
`/api/v1/scheduling/events|resources|schedules|leaves|holidays/`,
`/api/v1/audit/` (flat list-only alias, frontend shape) + `/api/v1/audit/*` (read-only), `/api/v1/settings/*` (no `pipeline/` — mock-only, no caller),
`/api/v1/intelligence/*` (stubs + knowledge), `/api/v1/core/tags/`,
`/api/v1/attachments/` (RAW[] compat) + `/api/v1/core/attachments/` (paginated).

## Permissions

Domain viewsets: `IsAuthenticatedPermission + HasPermission` (permission_map
codes, staff/superuser short-circuit, org membership for scoping).
Project-scoped/nested views: authenticated + org/project membership gate (403
otherwise). Writes derive ownership server-side; bulk ops validate per item
and report partial failures (never half-apply silently).
