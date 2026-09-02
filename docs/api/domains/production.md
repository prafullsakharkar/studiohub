# Production Domain API

**All slices now MATCHED** via `apps.production` (Phase D) — Projects/Shots/Assets/Tasks/Timelogs/Versions/Reviews/Playlists/Media/Workflows/Scheduling/Analytics are implemented (some as minimal stubs with correct contract shapes). This document captures the required contract so implementation follows architecture (Core → Identity → Organization → Production), not mock shapes.

Status legend: **MATCHED** where implemented.

## 1. Projects ✅ MATCHED (Phase D.1) — `apps/production` `ProjectViewSet` at `/api/v1/projects/`

| Operation | Notes | Status |
|---|---|---|
| LIST | paginated (`StandardPagination`); `search` over name/code/description; `ordering`; filters `status`,`type` | **MATCHED** |
| RETRIEVE `{id}/` | 404 → `{"detail":"Not found."}` | **MATCHED** |
| CREATE | body: name*, code*, type, description, status, fps, resolution, aspect_ratio, color_space, start_date, delivery_date, thumbnail_url, budget_usd, supervisor, coordinator, client fields; 201 returns `{id,uuid,...}` | **MATCHED** |
| UPDATE | PATCH/PUT partial merge | **MATCHED** |
| DELETE | 204 (soft-delete) | **MATCHED** |

## 2. Sequences ✅ MATCHED — `SequenceViewSet` at `/api/v1/sequences/`

First-class `Sequence` model (org + `project` FK, `code` unique per project, `name`, `status`, `description`, `frame_in/out`, `department`, `tags`, `metadata`). Soft-delete (archive) via `EntityModel`; `unique_together=(project, code)`.

- LIST: paginated (`StandardPagination`); `search` code/name/description/department; filters `project`, `status`; `ordering` (`code`/`name`/`created_at`/`status`).
- RETRIEVE `{id}/` → `SequenceDetailSerializer` (adds `project_id`, `project_code`, `project_name`, `shots_count`, `is_deleted`, `deleted_at`).
- CREATE: `project`, `code`*, `name`, `status`, `description`, `frame_in` (default 1001), `frame_out` (default 1100), `department`, `tags`, `metadata`.
- UPDATE / PARTIAL_UPDATE via `SequenceUpdateSerializer`.
- `GET archived/` → paginated list of soft-deleted sequences for the active org (optionally `?project_id=`) | **MATCHED**.
- Bulk actions (all org-scoped, fail closed, per-item envelope):
  - `POST bulk-create/` `{items:[{project_id, code*, name, status, description, frame_in, frame_out, department, tags, metadata}]}` → per-item `created|exists|soft_deleted|duplicate|invalid`, each in its own transaction.
  - `PATCH bulk-update/` `{items:[{id, ...fields}]}` → per-item `updated|not_found|invalid`.
  - `POST bulk-archive/` `{ids:[]}` → soft-delete, per-item `archived|not_found`.
  - `POST bulk-restore/` `{ids:[]}` → per-item `restored|not_found`.
  - `POST existence-check/` `{items:[{project_id, code}]}` → per-item `new|exists|soft_deleted|duplicate|invalid` (client reconciles before create).
  - `POST {id}/restore/` → restore a single soft-deleted sequence.

Bulk envelope shape: `{processed, successful, failed, results:[{index, status, id?, code?, deleted_at?, error?, entity?}]}` where `entity` is the serialized record for success statuses.

## 3. Shots ✅ MATCHED (Phase D.1) — `ShotViewSet` at `/api/v1/shots/`

- LIST: paginated; search code/name/description/sequence_code; filters `project`, `status`, `sequence_code`; `ordering`.
- CREATE: `project` (FK), `sequence_code`, `code`, `name`, `description`, `status`, `frame_in/out`, `handle_frames`, `thumbnail_url`, `video_url`, `assigned_artist`, `pipeline` (defaults to all `Not Started` if omitted).
- PATCH: partial merge (pipeline JSON merge handled by serializer).
- `POST {id}/approve/` → sets `status='Approved'`, `supervisor_approved=true`, all pipeline stages `Approved` → 200. | **MATCHED** |

## 4. Assets ✅ MATCHED (Phase D.1) — `AssetViewSet` at `/api/v1/assets/`

- LIST paginated; search name/code/category/description; filters `project`, `category`, `status`.
- CREATE: `project`, `name`, `code`, `category`, `status`, `file_format`, `poly_count`, `lod_levels`, `software`, `department`/`team`/`assigned_artist`, `tags`, `usd_prim_path`; 201 returns `{id,uuid,...}` with denormalized `project_code/name`, `department_name` etc.
- PATCH / DELETE (204, soft-delete via `is_archived` for future). | **MATCHED** |

## 5. Tasks ✅ MATCHED (Phase D.2) — `TaskViewSet` at `/api/v1/tasks/`

- LIST paginated; filters `project`, `entity_type`, `entity_id`, `department`, `status`, `priority`, `is_archived` (frontend `is_archived=ALL` handled as no filter); search `title`/`code`.
- CREATE: `project`, `title`, `code`, `entity_type`/`entity_id`/`entity_code`/`entity_name`, `department`, `team`, `assignee`/`reviewer`/`vendor` refs, `workflow`/`schedule`/`dependencies` JSON, `status`/`priority`, `tags`, `is_archived`.
- PATCH: partial merge (schedule JSON merge handled by serializer).
- Bulk actions: `POST bulk-assign/` (`{task_ids, assignee_id, team_id}` → `{success,updated_count}`), `bulk-status/`, `bulk-archive/`, `bulk-delete/` — all transactional via `TaskService` / direct `QuerySet` updates, returning `{success,updated_count/deleted_count}`.

## 6. Time Logs ✅ MATCHED (Phase D.2) — `TimelogViewSet` at `/api/v1/timelogs/`

- LIST paginated; filters `task`, `project`, `person`, `status`, `billable`, `date`; `search` notes; ordered `-date`.
- CREATE: `task`, `project` (auto from task), `person` (auto from `request.user` if not provided), `duration_hours`, `date`, `billable`, `notes`, `activity_category`, `hourly_rate_usd` → denormalized `task_code`/`task_title`/`project_code` from `Task`.
- `POST {id}/approve/` → `status='Approved'`, `approved_by`/`approved_at` set.
- `POST {id}/reject/` (`{rejection_reason}`) → `status='Rejected'`.

## 7. Versions ✅ MATCHED (Phase D.3) — `VersionViewSet` at `/api/v1/versions/`

Reconciled to `ProductionVersion` (richer): `code`/`version_number`/`entity_*`, `shot`/`asset`/`task` FKs, `department`, `artist`, `status`, `is_published`/`is_hero`/`is_archived`, `publishing_info` JSON, `media_items`/`attachments` etc. Actions: `publish` (merge `publishing_info`), `unpublish`, `archive`, `promote` (hero), `add-to-playlist` (also updates `Playlist`).

## 8. Reviews ✅ MATCHED (Phase D.4) — `ReviewViewSet` at `/api/v1/reviews/`

- LIST paginated; `search` title/code/entity_code; filters `project`, `entity_code`, `status`.
- Lifecycle: `Draft` → `Submitted` → `In Review` → `Approved`/`Rejected`/`Retake` → `Closed` via `submit`/`start-review`/`approve`/`reject`/`request-changes`/`close`/`verdict` (`{verdict,notes}`) actions.
- Sub-resources: `annotations` (`{frame_number,timecode,author_name,comment,drawing_coordinates}` → 201), `comments` (`{text,is_client_visible}` → 201, `resolve`/`reopen` on `comments/{id}`), `notes` (`{category,author_name,author_role,content,is_pinned}` → 201).

## 9. Media & Playlists ✅ MATCHED (Phase D.5)

- `/api/v1/media/` (bare array) — `MediaViewSet` (`entity_type`/`entity_id`/`media_type`/`project`, `search`).
- `/api/v1/playlists/` (bare array) — `PlaylistViewSet` (`project`/`status`/`client_only`, `entries`/`share_settings` JSON) with `add-entry`/`remove-entry`/`reorder`/`share`/`archive`/`restore`.

## 10. Workflows & Automations ✅ MATCHED (Phase D.6)

- `/api/v1/workflows/` (paginated) — `WorkflowViewSet` (`category`/`is_active`/`department`, `nodes`/`transitions`/`automation_rules` JSON) with `simulate` (dry-run `WorkflowDryRunResult`), `clone`, `activate`/`deactivate`/`archive`.
- `/api/v1/automations/rules/` + `/audit-logs/` — bare array stubs via `GenericAPIView` (contract shape, no DB persistence required for now).

## 11. Scheduling ✅ MATCHED (Phase D.7) — stub `GenericAPIView`s

All bare arrays under `/api/v1/scheduling/` at correct paths (`events/`, `resources/`, `capacity/`, `overbooking/`, `holidays/`, `leaves/`, `resolve-overbooking/`) — return `[]`/stub ` {id}` with `IsAuthenticated`, `@extend_schema` + `DummySerializer` for OpenAPI 0 errors.

## 12. Analytics ✅ MATCHED (Phase D.7) — stub `GenericAPIView`s

- `GET /api/v1/analytics/kpis/` → `ProductionKpis` stub (see `AnalyticsKpisView`).
- `GET /api/v1/analytics/departments/` → `DepartmentProgress[]` stub.

## Missing Domain Models (remaining gaps) — *none for core; remaining are JSON-backed stubs*

All core production entities now have DB models: **Project, Sequence, Shot, Asset, Task, Timelog, Version, Review, Media, Playlist, Workflow** (with `ShotPipeline` as JSON `pipeline`, `Scheduling`/`Analytics` as stubs). Remaining to harden: `AutomationRule`/`AutomationAuditLog` as separate models (currently JSON on `Workflow`), and `Scheduling` resources as persistent models if needed (currently stubbed).

## Implementation Rules

1. Follow the organization app pattern end-to-end (selector reads, service writes,
   events, filtersets, permission_map).
2. Paginated endpoints per [pagination.md](../pagination.md); bare arrays only where this
   document marks them.
3. Preserve denormalized `*_name` display fields via serializer annotations.
4. Bulk endpoints belong behind services inside transactions, emitting one domain event
   per affected aggregate.
