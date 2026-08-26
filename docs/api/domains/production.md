# Production Domain API

**Everything in this document is MISSING BACKEND.** No production app/models exist in
`backend/apps/` — the entire contract is implemented only by frontend mocks
(`mocks/mockRouter.ts`, `mocks/handlers/*`, `mocks/db/production|tasks|versions|reviews|assets`).
This document captures the required contract so implementation follows architecture
(Core → Identity → Organization → Production), not mock shapes.

Status legend: all endpoints below are **MISSING BACKEND** unless noted.

## 1. Projects

`/api/v1/projects/`

| Operation | Notes |
|---|---|
| LIST | paginated (default 10); `search` over name/code/description/client_name; `ordering`; filters `status`,`type` |
| RETRIEVE `{id}/` | 404 → `{"detail":"Project not found"}` |
| CREATE | body: name*, code*, type (Feature Film\|Episodic Series\|Commercial\|Game Cinematic), description, status, fps, resolution, aspect_ratio, color_space, start_date, delivery_date, thumbnail_url, budget_usd, supervisor_id/name, coordinator_id/name, client_id/name, client_contact_id/name, vendor_ids[]/names[]/vendor_team_ids[]; 201 |
| UPDATE | PATCH/PUT partial merge |
| DELETE | 204 |

## 2. Shots

`/api/v1/shots/`

- LIST: paginated; search code/name/description(+sequence_code, assigned_artist_name); filter project_id/status/sequence_code.
- CREATE: project_id/code*, sequence_code, code*, name, description, status,
  frame_in/frame_out, handle_frames, thumbnail_url, video_url,
  assigned_artist_id/name → auto-creates pipeline
  `{layout, animation, fx, lighting, comp}` stages.
- PATCH: shallow merge + deep merge of `pipeline`.
- `POST {id}/approve/`: sets status='Approved', supervisor_approved=true, all pipeline
  stages 'Approved' → 200 updated shot.

## 3. Assets

`/api/v1/assets/`

- LIST paginated; search name/code/category/description(+assigned_artist_name); filters project_id/category/status/department_id.
- CREATE: project_id/code/name, category enum (Character\|Environment\|Vehicle\|Prop\|FX Rig\|Shader & LookDev\|Matte Painting\|Crowd Agent\|Costume / Groom), status, file_format, poly_count, lod_levels, software enum (Maya\|Houdini\|Blender\|ZBrush\|Substance Painter\|UE5\|Solaris\|Mari), department/team/assigned_artist refs, tags[], usd_prim_path.
- PATCH / DELETE (204).

## 4. Tasks

`/api/v1/tasks/`

- LIST paginated; explicit filters: project_id, entity_type, entity_id, department,
  team_id, assignee_id, vendor_id, status, priority, is_archived (`'ALL'` sentinel;
  archived hidden by default); rich search.
- CREATE: department/team/assignee/reviewer/vendor refs (+avatar/role display fields),
  `workflow{stage_name, step_name, step_number, total_steps, pipeline_template}`,
  `schedule{start_date, due_date, estimated_hours, logged_hours, progress_percent,
  milestone?, overrun_risk?}`,
  `dependencies{upstream_task_ids[], downstream_task_ids[]}`, description, software, tags.
- PATCH: deep merge of `schedule`; sync top-level due_date/estimated_hours/logged_hours.
- Bulk actions (**MSW-only today — the in-process router misses them, so they hit the
  network first**): `POST bulk-assign/ bulk-status/ bulk-archive/ bulk-delete/`
  with `{task_ids:[…], …}` → `{success:true, updated_count|deleted_count}`.

## 5. Time Logs

`/api/v1/timelogs/`

- LIST paginated; filters task_id/person_id/project_id/status/billable/start_date/end_date; default sort date desc.
- CREATE: task/project/person refs, duration_hours, date, billable, notes,
  activity_category, hourly_rate_usd → status defaults 'Submitted'; denormalized
  task/project fields resolved server-side.
- `POST {id}/approve/` ({approved_by_id?, approved_by_name?}) → status='Approved',
  approved_at set.
- `POST {id}/reject/` ({rejection_reason?}) → status='Rejected'.

## 6. Versions ⚠ DIVERGENT CONTRACTS

Two incompatible mock shapes exist and must be reconciled **before implementation**:

- MSW handlers: `PublishedVersion` — flat publish records
  (`entity_code, version_number, usd_stage_path, frame_range, file_size_mb, notes`,
  promote action).
- In-process router: `ProductionVersion` — richer record
  (shot/asset/task refs, artist{}, status, is_published/is_hero/is_archived,
  `publishing_info{dcc_software, dcc_version, usd_stage_path, usd_layer_identifier,
  pyblish_status Passed\|Warnings\|Failed, validation_errors, published_at,
  publisher_name}`, joined media_items[]/attachments[] on retrieve).

Recommended canonical shape: the router's `ProductionVersion` (the live UI uses it).

Endpoints: CRUD + `POST {id}/publish/ unpublish/ archive/ add-to-playlist/
({playlist_id,…}) promote/`. LIST paginated; filters project_id/entity_type/entity_id/
department/status/is_published.

## 7. Reviews

`/api/v1/reviews/`

- LIST paginated; search title/code/entity_code/lead_reviewer_name; filters
  project_id (id-or-code), entity_code, status, client_only.
- Status lifecycle: Draft → Submitted → In Review → Approved | Rejected | Retake |
  Changes Requested → Closed.
- Actions (POST, return updated session): `{id}/submit/ start-review/ approve/ reject/
  request-changes/ close/ verdict/ ({verdict, notes?})`.
- Sub-resources: `POST {id}/annotations/` ({frame_number?, timecode?, author_name?,
  comment?, drawing_coordinates?}) → 201; `POST {id}/comments/` → 201;
  `POST comments/{cid}/resolve/ reopen/`; `POST {id}/notes/`
  ({category, author_name, author_role, content, is_pinned}).

## 8. Media & Playlists

- `/api/v1/media/`: **bare array** list; filters entity_type/entity_id/media_type/
  project_id/search; full CRUD except noted; media_type image|video|…, category,
  file_format, storage_tier, source_url/preview_url.
- `/api/v1/playlists/`: **bare array**; filters project_id/client_only/status/search;
  entries[] with item_order/duration_frames/approval_status; share_settings{};
  actions `POST {id}/add-entry/ remove-entry/ reorder/ ({entries}) share/
  ({is_public, allow_client_approval, require_passcode, passcode, share_token,
  client_id, expires_at}) archive/ restore/`.

## 9. Workflows & Automations

- `/api/v1/workflows/`: paginated CRUD; graph shape
  `nodes[{type: start|task|condition|approval|publish|delivery|automation|end, config,
  position}]`, transitions[], automation_rules[], execution_stats{}; detail by id-or-code;
  actions `POST {id}/simulate/` (dry-run → WorkflowDryRunResult{simulation_id,
  overall_status, steps[], side_effects[], audit_entry}, writes an automation audit log),
  `clone/` (201 "(Copy)", inactive), `activate/ deactivate/ archive/`.
- `/api/v1/automations/rules/`: bare-array CRUD.
- `/api/v1/automations/audit-logs/`: bare array read.

## 10. Scheduling

All bare arrays under `/api/v1/scheduling/`:

- `events/` CRUD; filters incl. comma-multi `event_type`, office_id, assignee_id.
- `resources/` list+PATCH only (~30 rows: type, availability_status,
  capacity_weekly_hours, assigned_hours_current_week, is_overbooked, utilization_pct).
- `capacity/` computed per-department summaries.
- `overbooking/` alerts; `POST resolve-overbooking/` ({alert_id, resource_id?}).
- `holidays/` read; `leaves/` GET+POST.

## 11. Analytics

- `GET /api/v1/analytics/kpis/` → ProductionKpis singleton (total_shots,
  approved_shots, pending_review_shots, approval_rate_percentage, storage_usage_tb/quota_tb,
  render_nodes_busy/total, avg_render_time_mins).
- `GET /api/v1/analytics/departments/` → DepartmentProgress[]
  ({department, total_tasks, completed_tasks, percentage}).

## Missing Domain Models (documented gap list)

Project, Sequence (implied by sequence_code), Shot, ShotPipelineStage, Asset, Task,
TaskDependency, Timelog, Version (+ PublishingInfo), ReviewSession (+ Annotation,
ReviewComment, ReviewNote), MediaItem, Playlist (+ Entry), Workflow (+ Node, Transition),
AutomationRule, AutomationAuditLog, SchedulingEvent, Resource, ResourceLeave,
OverbookingAlert, StudioHoliday, AnalyticsKpis (or computed selectors).

These must be designed against `docs/03-domain/` before any model code is written —
mock shapes inform field requirements but do not define schema.

## Implementation Rules

1. Follow the organization app pattern end-to-end (selector reads, service writes,
   events, filtersets, permission_map).
2. Paginated endpoints per [pagination.md](../pagination.md); bare arrays only where this
   document marks them.
3. Preserve denormalized `*_name` display fields via serializer annotations.
4. Bulk endpoints belong behind services inside transactions, emitting one domain event
   per affected aggregate.
