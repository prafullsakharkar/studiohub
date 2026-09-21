# Audit API

Audit records are append-only and server-generated. All resources are
org-scoped via `AuditBaseSelector` (members see their organizations' rows;
staff bypass; anonymous sees nothing) and follow Core conventions: JWT auth,
`StandardPagination` (`{count,next,previous,results}`, `page`/`page_size`,
`search`, `ordering`), Core error envelope.

## Resources (all under `/api/v1/audit/`)

| Frontend basePath | Backend routes | Writes |
| ----------------- | -------------- | ------ |
| `/api/v1/audit` | `GET /api/v1/audit/` (list) + `GET /api/v1/audit/<uuid>/` (detail), frontend `AuditLog` shape | none — POST/PATCH/DELETE 405 |
| `/api/v1/audit/tracks` | `GET` list/detail + `POST /` ingest (`TrackIngestSerializer` in, full shape out) | client telemetry ingest (org/user resolved server-side) |
| `/api/v1/audit/api-requests` | `GET` list/detail | none (written by telemetry middleware) |
| `/api/v1/audit/background-jobs` | `GET` list/detail + `POST :uuid/retry/` + `POST :uuid/cancel/` | retry/cancel actions |
| `/api/v1/audit/change-logs` | `GET` list/detail | none (written by change-tracking signals) |
| `/api/v1/audit/error-logs` | `GET` list/detail + `POST :uuid/resolve/` | resolve action |
| `/api/v1/audit/login-history` | `GET` list/detail | none |
| org activity | `GET /api/organizations/{org}/activity/` (nested) + `GET /api/v1/activity/` (flat fallback for `getActivity()` with no active org) | none |

Detail lookup is by `uuid` on every resource.

## Filters (exact-match unless noted)

* Audit logs: `?action=` (case-insensitive — frontend sends UPPERCASE),
  `?severity=`, `?target_type=`, `?actor=`, `?organization=` / `?organization_id=`
  (frontend alias), `?created_at__exact/gte/lte=`, `?search=` (action, targets,
  description, actor email/display name).
* Change logs: `?change_type=`, `?target_type=`, `?user=`, `?organization=`,
  `?created_at__*=`, `?search=(target_type,target_name,description)`.
* Tracks / API requests / jobs / errors / logins: per-resource fields, see
  `apps/audit/filters/*.py`. Every viewset returns the **filtered** queryset
  (`.qs`) — a previous revision silently dropped FilterSet filtering on all
  namespaced resources (fixed Phase 6).

## Frontend shape mapping (flat alias)

`AuditLogFrontendSerializer` maps backend columns onto the frontend
`AuditLog` type: `target_type→entity_type`, `target_id→entity_id`,
`target_name→entity_code`, `actor_id→user_id`, `metadata→changes_diff`, plus
`user_name` (profile display name → email) and `user_email`.

`ChangeLogSerializer` exposes real `before_values`/`after_values`/
`changed_fields` (recorded by signals, never fabricated).

## Event generation

* `AuditConfig.ready()` registers change tracking on 8 models
  (`production.{Project,Sequence,Shot,Asset,Task,Version}`,
  `deliveries.DeliveryPackage`, `publishing.PublishItem`): create writes
  `{}→after`, update writes `before→after` (noop saves write nothing), delete
  writes `before→{}`. Actor comes from request thread-local context.
* `APITelemetryMiddleware` writes one `APIRequest` per `/api/v1/*` call
  (metadata only).
* 5xx responses write `ErrorLog` rows via the Core exception handler.
* All writers are best-effort (`try/except: pass`) — audit never breaks
  business operations.

## Append-only policy

`POST /api/v1/audit/` → 405 (locked by regression test). Rationale: the audit
trail must only contain server-observed events. Frontend `recordLog` callers
are best-effort and mock-gated (Record modal renders in mock mode only; the
access-store call is fire-and-forget). Client telemetry has its own ingest
path (`POST /api/v1/audit/tracks/`).

## Status codes

`200` list/detail · `201` track ingest / job actions return the updated row ·
`400` invalid filter values · `401` anonymous · `404` unknown uuid/org ·
`405` writes on append-only resources.

## Tests

* `apps/audit/tests/api/test_flat_alias.py` — flat shape, search/action filter.
* `apps/audit/tests/api/test_audit_filter_contract.py` (Phase 6, 11 tests) —
  `organization_id` alias, tenant isolation for members, flat detail + 404,
  append-only lock, `/api/v1/activity/` envelope, namespaced filtering with
  negative controls (change-logs, tracks + search/ordering), before/after shape.
* Existing: viewset 405/401 matrix, change-tracking signals, telemetry
  writers, selector/security suites.
