# StudioHub React — Mock Data Inventory

Source: `/home/prafull.sakharkar/Repository/github/studiohub-react/src/mocks/db/**`
+ `src/types/**`. Conventions: `BaseEntity{id,created_at,updated_at,created_by?,
updated_by?,is_deleted?,deleted_at?}` (`types/common.ts:1-9`); `ProductionStatus =
Not Started|Turnover|Bidding|In Progress|Pending Review|Approved|Retake|Final Color|
Completed|On Hold|Archived|Omitted (+lowercase variants)`; `PriorityLevel =
Low|Medium|High|Critical`; dates `YYYY-MM-DD`, datetimes ISO strings; ids are strings.

---

## Organization (`db/organization/organization.ts`, 47KB; type `types/organization.ts`)
- Fields: `id,name,code,slug?,type?,status(Active|Archived|…),tier?,location?,email?,
  description?,logo_url?,settings?,created_at,updated_at`.
- Mock: 4 orgs (`org-apex-01` Apex…, `org-vanguard-02`, `org-weta-03`, `org-framestore-04`).
- Relationships: root tenant → everything (`organization_id` on projects/members).
- Consumers: `OrganizationContext`, `organizationApi`, switcher, all org-scoped hooks.

## User (`db/identity/users.ts`, 44KB: `mockUsers`; type `types/auth.ts`)
- Fields: `id,email,full_name,first_name?,last_name?,avatar_url?,role?,department?,
  organization_id?,memberships:OrganizationMembership[],project_memberships:ProjectMembership[]?,
  permissions:Permission[],is_superuser?,status?,phone?,timezone?,created_at?`.
- Mock users `usr-001` Alex Chen (default / superuser-ish), `usr-002` Marcus Vance, …
- Consumers: auth, members lists, assignee/reviewer/artist denormalized fields everywhere.

## OrganizationMembership (`types/auth.ts:315`)
- Fields: `id,user_id,organization_id,organization_name,organization_code?,organization_slug?,
  organization_logo_url?,role,permissions[],is_default?,status(Active|…),department?,joined_at?`.
- Consumers: `useAuth`, `OrganizationContext` (active-org filtering), org guards.

## ProjectMembership (`types/auth.ts:358`; mock data embedded on `user.project_memberships`)
- Fields: `id,user_id?/userId?,organization_id?/OrganizationId?,project_id?/projectId?,
  project_code?,project_name?,role?/roles?[],scope?(PROJECT|ORGANIZATION|GLOBAL|…),
  permissions?[],status(Active|Inactive|Suspended|Pending|Invited),department?,department_id?,
  team_id?,vendor_id?,client_id?,joined_at?` (+ denormalized `name,email,avatar_url` in list view).
- Consumers: project-scoped guards, `members` endpoints, scope filtering.

## Project (`db/production/projects.ts`, 8 records; type in mock file)
- Required: `name,code`. Defaults: `type=Feature Film,status=In Progress,fps=24,
  organization_id=user org||org-apex-01`.
- Fields: `type(Feature Film|Episodic Series|Commercial|Game Cinematic),description,status,fps,
  resolution,aspect_ratio,color_space,start_date,delivery_date,thumbnail_url,total_shots,
  approved_shots,in_progress_shots,total_assets,budget_usd,supervisor_id/_name,coordinator_id/_name,
  client_id/_name,client_contact_id?/_name?,vendor_ids[]?/vendor_names[]?/vendor_team_ids[]?,organization_id?`.
- Example: `proj-001/NK99 "Cyberpunk 2099: Neo-Kyoto", In Progress, org-apex-01, cl-001`.
- Relationships: org → project; project → sequences/shots/tasks/assets/versions/reviews/notes/editorial/deliveries/files.
- Consumers: production module, project switcher, project-scoped API, dashboard.

## Sequence (`db/production/sequences.ts`; type `types/sequences.ts:36`)
- Fields: `project_id,project_code?,code(uppercased),name,description?,status,department?,
  lead_artist_id?/_name?,frame_start?/frame_end?,thumbnail_url?,is_deleted?,…`.
- Relationships: org → project → sequence → shots.
- Consumers: sequences module, shot creation (sequence_code), bulk import.

## Shot (`db/production/shots.ts`, 9 records)
- Fields: `project_id/project_code/project_name?,sequence_code?,code(unique/project),
  name,description?,status,frame_in/out(1001–1120)/handle?,thumbnail_url?,video_url?,
  current_version?,assigned_artist_id?/_name?,supervisor_approved?,client_approved?,
  pipeline{step:Not Started|…},department?,…`.
- Example: `shot-001/NK_010_010`, frames 1001–1120.
- Relationships: sequence_code → Sequence; `shot.asset ↔ version.entity_id`.
- Consumers: shots module, tasks (`entity_type=Shot`), versions, reviews, pipeline tab.

## Asset (`db/assets/assets.ts`, 11 records; enums `AssetCategory`×9, `AssetSoftware`×8)
- Fields: `project_id/project_code/project_name?,name,code(unique/project),category(Character|
  Environment|Vehicle|Prop|FX Rig|Shader & LookDev|Matte Painting|Crowd Agent|Costume / Groom),
  description,status,version(v002…v012),thumbnail_url,turntable_video_url?,file_format,
  poly_count,lod_levels,software,department_id/_name,team_id/_name,assigned_artist_id?/_name?/_avatar?,
  approved_by_id?/_name?,parent_asset_id?/_name?,children_count?,tags[],usd_prim_path?,usd_stage_url?,
  material_count?,texture_resolution?,bounding_box?,review_status?,task_status?,is_archived?,
  versions?:AssetVersionRecord[],hierarchy?:AssetHierarchyNode[]`.
- Example: `ast-001…011`, 9× `proj-001/NK99`.
- Consumers: assets module, tasks (`entity_type=Asset`), versions, publishing (`entity_type`).

## Task (`db/tasks/tasks.ts`, 11 records; type `types/tasks.ts:36`)
- Fields: `title,code(unique/project: TSK-FX-1092…),project_id/_code/_name,entity_type(Shot|Asset|
  Sequence|General),entity_id/_code/_name,department(+_id?/_code?),team_id?/_name?,assignee_id?/_name?/
  _avatar?/_role?,reviewer_id?/_name?/_avatar?,vendor_id?/_name?/_code?,workflow?{stage_name,step_name,
  step_number,total_steps},status,priority,schedule{start_date,due_date,estimated_hours,logged_hours,
  progress_percent,milestone?,overrun_risk?}(+flat legacy due_date?/estimated_hours?/logged_hours?),
  dependencies?{upstream_task_ids[],downstream_task_ids[]},description,software,tags?,is_archived?`.
- Consumers: tasks module, scheduling/resources aggregation, dashboard, timelogs (`task_id`).

## Timelog (`db/tasks/timelogs.ts`; type `types/tasks.ts:84`)
- Fields: `task_id/_code/_title,project_id/_code/_name,person_id/_name/_avatar?/_role?,department,
  duration_hours,date,billable,notes,status(Draft|Submitted|Approved|Rejected),approved_by_id?/_name?/
  _at?,rejection_reason?,activity_category(8-enum),hourly_rate_usd?`.
- Consumers: timelog tabs, approve/reject flows, resources `hours_logged`.

## Version (`db/versions/versions.ts`, 5 `ProductionVersion`; MSW uses `PublishedVersion`)
- Fields: `entity_type/entity_id/_code/_name,project_id?,code,version_number/index,status,
  department?,artist_id?/_name?,is_published?/is_hero?/is_archived?,thumbnail_url?,video_url?,
  source_url?,frame_range/start/end?,resolution?,fps?,file_size?,notes?,changelog?,tags?,
  publishing_info?,media?[],attachments?[],reviews?[],playlists?[],activity?[]`.
- Consumers: versions module, reviews (versions[]), playlists entries, publishing.

## ReviewSession (`db/reviews/reviews.ts`, 28KB; type `types/reviews.ts:215`)
- Fields: `code,title,description?,entity_type/_id/_code,project_id?,status(Draft|In Review|
  Approved|Retake|Changes Requested|Closed…),lead_reviewer_id?/_name?,thumbnail_url?,video_url?,
  versions[]?,reviewers[]?{user_id,name,verdict,…},participants[]?{id,verdict,…},
  comments[]?{id,author,body,resolved,…},notes[]?,annotations[]?{frame_number,timecode,
  author_name,comment,drawing_coordinates?}`.
- Consumers: reviews module (workspace, playlists, modals), verdict/approve flows.

## MediaItem (`db/production/media.ts`; type `types/media.ts:44`)
- Fields: `entity_type/_id,project_id?,media_type,category?,file_format?,title?,code?,file_name?,
  source_url?,preview_url?,thumbnail_url?,file_size_mb?,…`.
- Consumers: files tab (project-scoped `files`), media module.

## AttachmentItem (`db/production/attachments.ts`; type `types/attachments.ts:55`)
- Fields: `entity_type/_id,project_id?,category?,file_name?,title?,mime_type?,file_size?,url?,…`.
- Consumers: attachments module, version attachments.

## Playlist (`db/production/playlists.ts`; type `types/playlists.ts:89`)
- Fields: `name,code?,project_id?,status,client_only?,entries[]?{id,version_id,…},
  share_settings?{},…`.
- Consumers: playlists module, reviews playlists, version `add-to-playlist`.

## EditorialCut (`db/production/editorial.ts`; interface in file)
- Fields: `project_id/_code,sequence_code?,name,code,cut_type(Conform|Turnover|Rough Cut|
  Fine Cut|Picture Lock|Trailer Teaser),version,fps,duration_frames,duration_tc,start_tc,end_tc,
  source_edl_filename,xml_manifest_url?,total_shots_in_cut,matched_vfx_shots,unmatched_shots,
  editorial_notes,editor_name,conformed_by,status,burn_in_lut,thumbnail_url`.
- Example: `edit-cut-001/CUT-NK-010-v04`, Turnover, 4200f.
- Consumers: project-scoped `editorial` tab only.

## ProjectNote (`db/production/notes.ts`; interface in file)
- Fields: `project_id/_code,entity_type(Project|Sequence|Shot|Asset|Task|Version),entity_id?/_code?/
  _name?,author_id/_name/_avatar?/_role,subject,body,category(Director Feedback|Supervisor Note|
  Client Note|Pipeline Notice|Turnover Requirement|General),priority,tags[],status(Open|Addressed|
  Closed),addressed_by?/_at?,timecode_ref?,frame_number?`.
- Consumers: project-scoped `notes` tab (list + create).

## Department / Team / Office (`organization.ts`)
- `DepartmentEntity{id,name,code,organization_id,…}`; `Team{id,name,code,lead_id?,member_ids[]?,
  organization_id,…}`; `Office{id,name,code,city?,timezone?,organization_id,…}`.
- Consumers: org tabs, task/asset department fields, filters.

## Position / CrewInvitation (`workspaceData.ts`)
- `Position{id,title?,name?,code?,department_id?,organization_id,…}`;
  `CrewInvitation{id,email,role,status(Pending|Accepted|…),organization_id,…}` (+resend/cancel).
- Consumers: people/crew tabs, invitation flows.

## Client / Vendor (+contacts/contracts) (`organization.ts`, `clientVendorDetails.ts`)
- `Client|Vendor{id,name,code,contact_name?/email?/phone?,status,organization_id,
  studio_type?|specialization?,contract_tier?,rating?,location?,active_projects?[]}`;
  contacts `{name,email,role,phone,portal_access?}`; contracts `{contract_number,title,type,
  effective/expiry_date,value_usd,status}`.
- Mock: `cl-001` Warner Nexus Studios; vendors `ven-001/002`.
- Consumers: org client/vendor tabs, project `client_id/_name`, `vendor_ids[]`.

## Person (`organization.ts`)
- `Person{id,name,full_name?,email,phone?,organization_id?,…}` — directory of crew.
- Consumers: people tab, timelog `person_id`, task assignees (via users).

## Role / Group / Permission (`workspaceData.ts`; types `rbac.ts`, `organization.ts`)
- `AccessRole{id,name,code,permissions[],organization_id,…}`;
  `AccessGroup{id,name,member_ids[]?,…}`; `PermissionDefinition{id,code(module:action),
  resource?,category?,…}`.
- Consumers: access/RBAC pages, permission guards, `authorizeActionOrDeny`.

## ApiKey / PAT (`workspaceData.ts`)
- `ApiKeyItem{id,name,key_prefix?,scopes[]?,status(Active|Revoked),…}`;
  `PersonalAccessTokenItem{…}`.
- Consumers: settings/API access tabs.

## WorkCalendar / WorkHours / CalendarEvent / Holiday (`workspaceData.ts`, `scheduling.ts`)
- Calendars, holidays, leaves, shifts; scheduling module reads `scheduling.ts` (50KB).
- Consumers: scheduling pages, calendar views.

## StudioBilling / ProductionReport / StudioNotification (`organization.ts`)
- Billing `{tier,limits,…}`, reports, notifications — dashboard/platform pages.

## DeliveryPackage (`db/production/deliveries.ts`; type `types/deliveries.ts:196`)
- Fields: `name,code,project_id?,client_id?/_name?,status(Draft|…),delivery_method?,
  total_size_bytes?/frames?,manifest?[],…`.
- Consumers: deliveries module (direct mock import — no apiClient), project-scoped `deliveries`.

## PublishItem (`db/production/publishing.ts`; type `types/publishing.ts:120`)
- Fields: `name,code,entity_type(Shot|Asset),entity_id/_code/_name,dcc_tool?,status
  (Pending|…),validation?[],…`.
- Consumers: publishing module (direct mock import).

## Workflow / Automation (`db/production/workflow.ts` 29KB; types `workflow.ts`, `automations.ts`)
- `Workflow{id,name,code,project_id?,category?,is_active?,nodes[],transitions[]?…}`;
  automation rules `{id,name,trigger,conditions,actions,is_active}` + audit logs.
- Consumers: workflows module (Studio/canvas/simulator).

## Scheduling entities (`db/production/scheduling.ts` 50KB; type `types/scheduling.ts:206`)
- Resources, events, schedules, leaves, capacity/overbooking alerts.
- Consumers: scheduling module.

## Audit / Activity (`db/audit/*.ts`)
- `AuditLog`, `ActivityEvent{action,actionLabel,description,actor,entity,…}` — activity tab,
  audit pages, project-scoped `activity`.

## Settings (`db/settings/settings.ts`)
- Pipeline settings object (`settings/pipeline/`).

## Intelligence / Knowledge / Analytics (`db/intelligence/*`, `db/analytics/metrics.ts`)
- AI chat/risks/recommendations, knowledge docs, search saved/recent, KPIs, department metrics.
- Consumers: intelligence + dashboard services (direct mock imports, no apiClient).

## Mock dataset volumes (approx)
Organizations 4 · Users ~10+ · Projects 8 · Sequences ~9+ · Shots 9 · Assets 11 ·
Tasks 11 · Timelogs ~10+ · Versions 5 · Reviews ~6+ · Playlists ~4+ · Clients ~4+ ·
Vendors ~4+ · People ~15+ · Departments/Teams/Offices/Positions/Invitations/Roles/
Groups/Permissions/ApiKeys/PATs/Calendars/Holidays/WorkHours (workspaceData, dozens) ·
Editorial ~4+ · Notes ~10+ · Deliveries ~4+ · Schedules/Resources ~20+.
