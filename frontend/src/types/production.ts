import { BaseEntity, Department, PriorityLevel, ProductionStatus } from './common';

// ---------------------------------------------------------------------------
// from projects.ts
// ---------------------------------------------------------------------------

export type ProjectWorkflowType = 'Standard' | 'Episodic';
export type ProjectType =
  | 'Feature Film'
  | 'Episodic / TV'
  | 'Episodic'
  | 'Standard'
  | 'Commercial'
  | 'Game Cinematic'
  | 'Special Venue'
  | string;
export type ProjectStatus =
  | 'Bidding'
  | 'In Production'
  | 'In Progress'
  | 'Active'
  | 'Hiatus'
  | 'Delivered'
  | 'Archived'
  | string;
export interface ProjectSettings {
  fps?: number;
  resolution_width?: number;
  resolution_height?: number;
  color_working_space?: string;
  ocio_config_path?: string;
  storage_root_nas?: string;
  cloud_bucket?: string;
  [key: string]: any;
}
export interface ProjectFinancials {
  currency?: string;
  budget_total?: number;
  budget_spent?: number;
  bid_days?: number;
  actual_days?: number;
  target_margin_percent?: number;
  [key: string]: any;
}
export interface Project extends BaseEntity {
  name: string;
  code: string;
  type: ProjectType;
  status: ProjectStatus;
  client_id?: string;
  client_name?: string;
  vfx_supervisor_id?: string;
  vfx_supervisor_name?: string;
  producer_id?: string;
  producer_name?: string;
  start_date: string;
  delivery_date: string;
  workflow_type?: ProjectWorkflowType;
  is_episodic?: boolean;
  isEpisodic?: boolean;
  project_type?: 'standard' | 'episodic' | string;
  settings?: ProjectSettings;
  financials?: ProjectFinancials;
  thumbnail_url?: string;
  description?: string;
  [key: string]: any;
}
/** What `isEpisodicProject` reads: the API's `workflow_type` and `type`, and the older spellings still seen in stored data. */
export interface EpisodicLike {
  workflow_type?: string | null;
  type?: string | null;
  is_episodic?: boolean;
  isEpisodic?: boolean;
  project_type?: string;
  settings?: { workflow_type?: string } | null;
}
export function isEpisodicProject(project?: EpisodicLike | null): boolean {
  if (!project) return false;
  return Boolean(
    project.is_episodic === true ||
    project.isEpisodic === true ||
    // `workflow_type` is the authority and the backend sends it lower case ('standard' | 'episodic'); `type` is a separate label.
    String(project.workflow_type ?? '').toLowerCase() === 'episodic' ||
    project.project_type === 'episodic' ||
    project.type === 'Episodic' ||
    project.type === 'Episodic / TV' ||
    project.type === 'Episodic Series' ||
    project.settings?.workflow_type === 'Episodic'
  );
}
export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  user_name?: string;
  email?: string;
  role?: string;
  department?: string;
  created_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from shows.ts
// ---------------------------------------------------------------------------

export interface Show extends BaseEntity {
  project_id: string;
  name: string;
  code: string;
  type?: string;
  status?: ProductionStatus | string;
  season?: string;
  episode_count?: number;
  total_shots?: number;
  approved_shots?: number;
  in_progress_shots?: number;
  total_assets?: number;
  start_date?: string;
  delivery_date?: string;
  thumbnail_url?: string;
  description?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from sequences.ts
// ---------------------------------------------------------------------------

export interface Sequence extends BaseEntity {
  project_id: string;
  project_code?: string;
  episode_id?: string;
  episode_code?: string;
  episode_name?: string;
  name: string;
  code: string;
  description?: string;
  status?: 'Active' | 'On Hold' | 'Approved' | 'Omitted' | 'In Progress' | string;
  shot_count?: number;
  shots_count?: number;
  approved_shots?: number;
  frame_in?: number;
  frame_out?: number;
  [key: string]: any;
}
export interface SequenceFilterParams {
  project_id?: string;
  episode_id?: string;
  status?: string;
  search?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from shots.ts
// ---------------------------------------------------------------------------

export type { ProductionStatus };
export type ShotPipelineStatus = ProductionStatus | string;
export interface ShotCutInfo {
  frame_in?: number;
  frame_out?: number;
  handle_in?: number;
  handle_out?: number;
  duration_frames?: number;
  fps?: number;
  editorial_version?: string;
  retime_info?: string;
  [key: string]: any;
}
export interface PlateInfo {
  plate_name?: string;
  resolution?: string;
  lens?: string;
  camera?: string;
  color_space?: string;
  aspect_ratio?: string;
  distort_grid_path?: string;
  [key: string]: any;
}
export interface Shot extends BaseEntity {
  code: string;
  name: string;
  project_id: string;
  project_code?: string;
  episode_id?: string;
  episode_code?: string;
  episode_name?: string;
  sequence_id?: string;
  sequence_code?: string;
  status: ProductionStatus;
  priority?: PriorityLevel;
  cut_info?: ShotCutInfo;
  plate_info?: PlateInfo;
  assigned_artist_id?: string;
  assigned_artist_name?: string;
  department_lead_id?: string;
  vendor_id?: string;
  current_version?: string;
  thumbnail_url?: string;
  description?: string;
  frame_count?: number;
  due_date?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from episodes.ts
// ---------------------------------------------------------------------------

export interface Episode extends BaseEntity {
  project_id: string;
  project_code?: string;
  code: string;
  name: string;
  episode_number?: number | string;
  season_number?: number | string;
  description?: string;
  status?: 'Active' | 'In Progress' | 'On Hold' | 'Approved' | 'Delivered' | 'Archived' | string;
  sequence_count?: number;
  shot_count?: number;
  frame_in?: number;
  frame_out?: number;
  duration_frames?: number;
  air_date?: string;
  delivery_date?: string;
  is_deleted?: boolean;
  archived?: boolean;
  metadata?: Record<string, any>;
  [key: string]: any;
}
export interface EpisodeFilterParams {
  project_id?: string;
  status?: string;
  search?: string;
  include_deleted?: boolean;
  page?: number;
  page_size?: number;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from assets.ts
// ---------------------------------------------------------------------------

export type AssetCategory =
  | 'Character'
  | 'Environment'
  | 'Vehicle'
  | 'Prop'
  | 'FX Rig'
  | 'Shader & LookDev'
  | 'Matte Painting'
  | 'Crowd Agent'
  | 'Costume / Groom'
  | string;
export type AssetSoftware =
  | 'Maya'
  | 'Houdini'
  | 'ZBrush'
  | 'Substance Painter'
  | 'Blender'
  | 'Unreal Engine'
  | 'Clarisse'
  | 'Katana'
  | string;
export interface AssetVersionRecord {
  version: string;
  published_at?: string;
  published_by?: string;
  published_by_avatar?: string;
  dcc_software?: string;
  file_format?: string;
  file_size_mb?: number;
  poly_count?: number;
  lod_levels?: number;
  usd_layer_path?: string;
  is_hero?: boolean;
  comment?: string;
  pyblish_status?: 'Passed' | 'Failed' | 'Warning' | string;
  [key: string]: any;
}
export interface AssetTechnicalSpecs {
  poly_count?: number;
  lod_levels?: number;
  material_count?: number;
  texture_resolution?: string;
  bounding_box?: string;
  usd_prim_path?: string;
  usd_stage_url?: string;
  file_format?: string;
  [key: string]: any;
}
export interface AssetHierarchyNode {
  id: string;
  name: string;
  code: string;
  category: AssetCategory;
  parent_id?: string | null;
  children?: AssetHierarchyNode[];
  [key: string]: any;
}
export interface Asset extends Partial<BaseEntity> {
  id: string;
  project_id: string;
  project_code?: string;
  project_name?: string;
  name: string;
  code: string;
  category: AssetCategory;
  description?: string;
  status: ProductionStatus | string;
  version?: string;
  thumbnail_url?: string;
  turntable_video_url?: string;
  file_format?: string;
  poly_count?: number;
  lod_levels?: number;
  software?: AssetSoftware;
  department_id?: string;
  department_name?: string;
  team_id?: string;
  team_name?: string;
  assigned_artist_id?: string;
  assigned_artist_name?: string;
  assigned_artist_avatar?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  children_count?: number;
  tags?: string[];
  usd_prim_path?: string;
  usd_stage_url?: string;
  material_count?: number;
  texture_resolution?: string;
  bounding_box?: string;
  review_status?: string;
  task_status?: string;
  is_archived?: boolean;
  versions?: AssetVersionRecord[];
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from tasks.ts
// ---------------------------------------------------------------------------

export type TaskEntityType = 'Shot' | 'Asset' | 'Sequence' | 'General' | string;
export type TimelogCategory = 'Production' | 'Overtime' | 'Meeting' | 'Review' | 'R&D' | string;
export interface TaskSchedule {
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  logged_hours?: number;
  progress_percent?: number;
  milestone?: string;
  overrun_risk?: boolean;
  [key: string]: any;
}
export interface TaskDependency {
  task_id: string;
  task_code?: string;
  task_title?: string;
  dependency_type?: 'blocks' | 'blocked_by';
  status?: ProductionStatus;
  department?: Department;
  [key: string]: any;
}
export interface TaskDependencyContainer {
  upstream_task_ids?: string[];
  downstream_task_ids?: string[];
  [key: string]: any;
}
export interface Task extends BaseEntity {
  code: string;
  title: string;
  project_id: string;
  project_code?: string;
  project_name?: string;
  entity_type?: TaskEntityType;
  entity_id?: string;
  entity_code?: string;
  entity_name?: string;
  department?: Department | string;
  status: ProductionStatus;
  priority?: PriorityLevel;
  schedule?: TaskSchedule;
  assignee_id?: string;
  assignee_name?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  vendor_id?: string;
  dependencies?: TaskDependencyContainer & TaskDependency[] & any;
  [key: string]: any;
}
export interface Timelog extends BaseEntity {
  task_id: string;
  user_id?: string;
  user_name?: string;
  person_id?: string;
  person_name?: string;
  project_id?: string;
  hours?: number;
  log_date?: string;
  date?: string;
  description?: string;
  billable?: boolean;
  category?: TimelogCategory;
  [key: string]: any;
}
export interface ActiveTimerState {
  isRunning: boolean;
  activeTaskId: string | null;
  activeTaskCode: string | null;
  activeTaskTitle: string | null;
  activeProjectId: string | null;
  activeProjectCode: string | null;
  activeProjectName: string | null;
  department?: string;
  startTime: number | null;
  elapsedSeconds: number;
  isBillable: boolean;
  notes: string;
}

// ---------------------------------------------------------------------------
// from versions.ts
// ---------------------------------------------------------------------------

export interface VersionPublishingInfo {
  dcc_software?: string;
  dcc_version?: string;
  usd_stage_path?: string;
  usd_layer_identifier?: string;
  pyblish_status?: 'Passed' | 'Warnings' | 'Failed' | string;
  is_hero_promoted?: boolean;
  published_at?: string;
  publisher_name?: string;
  publisher_id?: string;
  comment?: string;
  [key: string]: any;
}
export interface ProductionVersion extends BaseEntity {
  entity_id?: string;
  entity_type?: 'Shot' | 'Asset' | string;
  version_number: number | string;
  code: string;
  task_id?: string;
  artist_id?: string;
  artist_name?: string;
  status: ProductionStatus;
  media_url?: string;
  thumbnail_url?: string;
  frame_count?: number;
  fps?: number;
  resolution?: string;
  publishing_info?: VersionPublishingInfo;
  [key: string]: any;
}
export type Version = ProductionVersion;
export interface VersionPlaylistRef {
  playlist_id: string;
  playlist_name?: string;
  order?: number;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from editorial.ts
// ---------------------------------------------------------------------------

export type TrackType =
  | 'Video'
  | 'Audio'
  | 'VFX Plates'
  | 'Reference'
  | 'Subtitles / Markers'
  | 'Editorial Conform'
  | 'VIDEO'
  | 'AUDIO'
  | string;
export type TrackStatus = 'Active' | 'Locked' | 'Muted' | 'Conformed' | 'Archived' | string;
export interface EditorialTrack extends BaseEntity {
  uuid?: string;
  project_id?: string;
  project_code?: string;
  show_id?: string;
  cut_id?: string;
  cut_name?: string;
  track_number?: number;
  track_type: TrackType;
  name: string;
  codec_or_format?: string;
  channels_or_resolution?: string;
  frame_rate?: number;
  is_locked?: boolean;
  is_muted?: boolean;
  is_solo?: boolean;
  color_tag?: string;
  color?: string;
  clip_count?: number;
  description?: string;
  status?: TrackStatus;
  start_tc?: string;
  end_tc?: string;
  track_index?: number;
  channel_index?: number;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from playlists.ts
// ---------------------------------------------------------------------------

export type PlaylistType =
  | 'Dailies Reel'
  | 'Client Review'
  | 'Supervisor Review'
  | 'Milestone Review'
  | 'Internal Dailies'
  | string;
export type PlaylistStatus =
  | 'Draft'
  | 'Ready for Review'
  | 'In Session'
  | 'Under Review'
  | 'Approved'
  | 'Completed'
  | 'Archived'
  | string;
export interface PlaylistShareSettings {
  is_public?: boolean;
  allow_client_approval?: boolean;
  require_passcode?: boolean;
  share_token?: string;
  client_id?: string;
  expires_at?: string;
  [key: string]: any;
}
export interface PlaylistActivity {
  id: string;
  type: string;
  actor_name: string;
  actor_avatar?: string;
  description: string;
  timestamp: string;
  [key: string]: any;
}
export interface PlaylistEntry {
  id: string;
  item_order?: number;
  order?: number;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  version_id?: string;
  version_number?: string | number;
  video_url?: string;
  thumbnail_url?: string;
  duration_frames?: number;
  frame_range?: string;
  fps?: number;
  artist_name?: string;
  department?: string;
  status?: string;
  approval_status?: string;
  notes_count?: number;
  review_id?: string;
  [key: string]: any;
}
export interface Playlist extends BaseEntity {
  code?: string;
  name: string;
  project_id: string;
  project_code?: string;
  project_name?: string;
  type?: PlaylistType;
  description?: string;
  author_name?: string;
  author_id?: string;
  author_avatar?: string;
  items_count?: number;
  total_duration_frames?: number;
  total_duration_timecode?: string;
  status?: PlaylistStatus;
  is_locked?: boolean;
  is_archived?: boolean;
  client?: any;
  share_settings?: PlaylistShareSettings;
  activity?: PlaylistActivity[];
  entries?: PlaylistEntry[];
  version_ids?: string[];
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from media.ts
// ---------------------------------------------------------------------------

export type MediaType = 'video' | 'image' | 'audio' | 'document' | '3d' | string;
export interface MediaItem extends BaseEntity {
  version_id?: string;
  name?: string;
  title?: string;
  code?: string;
  file_name?: string;
  file_path?: string;
  file_format?: string;
  mime_type?: string;
  size_bytes?: number;
  file_size_mb?: number;
  storage_location?: string;
  type?: MediaType;
  media_type?: MediaType;
  url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  resolution?: string;
  color_space?: string;
  project_id?: string;
  project_code?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from attachments.ts
// ---------------------------------------------------------------------------

export type AttachmentCategory =
  | 'Camera & Lens Report'
  | 'Color Pipeline Spec'
  | 'Concept Artwork'
  | 'Audio Track'
  | 'Reference Footage'
  | 'Production Brief'
  | 'Script & Notes'
  | 'Storyboard'
  | 'LUT / Color Profile'
  | 'HDRI / Environment Map'
  | 'Onset Metadata'
  | 'VFX Breakdown'
  | 'Call Sheet'
  | 'Legal & Clearance'
  | 'Script Notes'
  | string;
export interface AttachmentItem extends Partial<BaseEntity> {
  id: string;
  code?: string;
  file_name: string;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  entity_type?: 'shot' | 'asset' | 'task' | 'project' | 'sequence' | 'review' | 'version' | string;
  entity_id?: string;
  entity_code?: string;
  category: AttachmentCategory;
  file_type?: string;
  file_size_kb?: number;
  security_classification?: 'Internal Only' | 'Vendor Shareable' | 'Client Confidential' | 'Public' | string;
  uploaded_by?: string;
  uploaded_by_avatar?: string;
  uploaded_at?: string;
  version?: string;
  download_url?: string;
  preview_url?: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from scheduling.ts
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | 'milestone'
  | 'review'
  | 'delivery'
  | 'task'
  | 'project'
  | 'meeting'
  | 'leave'
  | 'holiday'
  | 'availability'
  | string;
export type CalendarEventPriority = 'Low' | 'Medium' | 'High' | 'Critical' | string;
export type CalendarEventStatus = 'Confirmed' | 'Tentative' | 'Cancelled' | 'In Progress' | 'Completed' | string;
export type ResourceCategory = 'person' | 'equipment' | 'facility' | 'team' | string;
export type ScheduleViewMode = 'day' | 'week' | 'month' | 'timeline' | 'resources' | 'capacity' | string;
export interface ResourceAssignment {
  id: string;
  resource_id: string;
  resource_name: string;
  task_id?: string;
  task_code?: string;
  task_title?: string;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  start_date: string;
  end_date: string;
  daily_hours?: number;
  total_hours?: number;
  role?: string;
  department?: string;
  status?: string;
  [key: string]: any;
}
export interface ResourceLeave {
  id: string;
  resource_id: string;
  resource_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days?: number;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  notes?: string;
  [key: string]: any;
}
export interface StudioHoliday {
  id: string;
  office_id?: string;
  office_name?: string;
  name: string;
  date: string;
  end_date?: string;
  type?: string;
  [key: string]: any;
}
export interface Resource extends BaseEntity {
  type: ResourceCategory;
  name: string;
  code: string;
  department_id?: string;
  department_name?: string;
  office_id?: string;
  office_name?: string;
  role?: string;
  avatar_url?: string;
  skills?: string[];
  equipment_type?: string;
  equipment_specs?: Record<string, any>;
  capacity_weekly_hours: number;
  capacity_daily_hours: number;
  assigned_hours_current_week: number;
  utilization_pct: number;
  availability_status: string;
  active_assignments_count: number;
  current_project_code?: string;
  is_overbooked: boolean;
  overbooking_reason?: string;
  assignments: ResourceAssignment[];
  leaves?: ResourceLeave[];
  [key: string]: any;
}
export interface CalendarEvent extends BaseEntity {
  title: string;
  description?: string;
  event_type: CalendarEventType;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  status?: string;
  priority?: CalendarEventPriority;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  milestone_id?: string;
  department?: string;
  department_id?: string;
  office_id?: string;
  office_name?: string;
  resource_id?: string;
  resource_name?: string;
  attendees?: string[];
  metadata?: Record<string, any>;
  [key: string]: any;
}
export interface SchedulingCapacitySummary {
  department: string;
  total_resources: number;
  total_capacity_hours: number;
  allocated_hours: number;
  free_hours: number;
  utilization_pct: number;
  overbooked_count: number;
  [key: string]: any;
}
export interface SchedulingOverbookingAlert {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  department: string;
  date: string;
  scheduled_hours: number;
  max_capacity_hours: number;
  excess_hours: number;
  conflicting_events: {
    id: string;
    title: string;
    project_code?: string;
    event_type?: string;
    hours?: number;
    [key: string]: any;
  }[];
  suggested_resolution?: string;
  [key: string]: any;
}
export interface ScheduleFilter {
  search?: string;
  projectCode?: string;
  eventType?: string;
  department?: string;
  officeId?: string;
  assigneeId?: string;
  resourceType?: string;
  showOverbookedOnly?: boolean;
  [key: string]: any;
}
export interface TimelineItem {
  id: string;
  title: string;
  start: string | Date;
  end: string | Date;
  type?: string;
  group?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from workflow.ts
// ---------------------------------------------------------------------------

export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'task'
  | 'approval'
  | 'condition'
  | 'action'
  | 'trigger'
  | string;
export interface WorkflowNode {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  workflow_id?: string;
  department?: Department | string;
  position_x?: number;
  position_y?: number;
  position?: { x: number; y: number };
  status?: ProductionStatus | string;
  assignee?: string;
  type?: WorkflowNodeType;
  config?: Record<string, any>;
  data?: Record<string, any>;
  [key: string]: any;
}
export type TransitionTriggerEvent =
  | 'status_changed'
  | 'approved'
  | 'rejected'
  | 'qc_passed'
  | 'qc_failed'
  | 'published'
  | string;
export interface WorkflowTransitionCondition {
  field?: string;
  operator?: string;
  value?: any;
  [key: string]: any;
}
export interface WorkflowTransition {
  id: string;
  from_node_id?: string;
  to_node_id?: string;
  source_node_id?: string;
  target_node_id?: string;
  source_port?: 'out' | 'true' | 'false' | 'default' | string;
  label?: string;
  condition?: WorkflowTransitionCondition;
  trigger_event?: TransitionTriggerEvent | string;
  [key: string]: any;
}
export interface WorkflowGraph extends BaseEntity {
  name?: string;
  project_id?: string;
  target_entity_type?: 'Shot' | 'Asset' | string;
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  [key: string]: any;
}
export interface Workflow extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  project_id?: string;
  project_code?: string;
  target_entity_type?: string;
  status?: 'active' | 'draft' | 'archived' | string;
  version?: number | string;
  is_active?: boolean;
  nodes?: WorkflowNode[];
  transitions?: WorkflowTransition[];
  graph?: WorkflowGraph;
  [key: string]: any;
}
export interface WorkflowDryRunStep {
  node_id: string;
  node_title: string;
  node_type: string;
  duration_ms: number;
  log_message: string;
  status?: 'passed' | 'failed' | 'skipped' | string;
  [key: string]: any;
}
export interface WorkflowDryRunResult {
  steps: WorkflowDryRunStep[];
  total_duration_ms: number;
  success?: boolean;
  errors?: string[];
  [key: string]: any;
}
export type WorkflowCategory =
  | 'Shot Pipeline'
  | 'Asset Pipeline'
  | 'Delivery Pipeline'
  | string;
export type AutomationTriggerEventType =
  | 'version.approved'
  | 'version.published'
  | 'task.status_changed'
  | 'task.blocked'
  | 'review.completed'
  | 'delivery.sent'
  | string;
export type AutomationActionType =
  | 'update_status'
  | 'assign_user'
  | 'send_slack'
  | 'trigger_webhook'
  | 'create_task'
  | 'submit_render'
  | 'publish_version'
  | 'notify_producer'
  | 'create_delivery'
  | 'update_project_status'
  | string;
export interface AutomationConditionRule {
  id?: string;
  field: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'in' | 'equals' | 'greater_than' | 'less_than' | string;
  value: any;
  [key: string]: any;
}
export interface AutomationActionRule {
  id?: string;
  type: AutomationActionType;
  label?: string;
  order?: number;
  parameters?: Record<string, any>;
  config?: Record<string, any>;
  [key: string]: any;
}
export interface AutomationRule extends Partial<BaseEntity> {
  id: string;
  name: string;
  description?: string;
  trigger_event?: AutomationTriggerEventType | string;
  trigger?: any;
  workflow_id?: string;
  is_active?: boolean;
  conditions?: AutomationConditionRule[];
  actions?: AutomationActionRule[];
  [key: string]: any;
}
export interface AutomationAuditLog extends Partial<BaseEntity> {
  id: string;
  rule_id?: string;
  rule_name?: string;
  trigger_event?: string;
  status?: string;
  details?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from reviews.ts
// ---------------------------------------------------------------------------

export type ReviewStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Archived' | 'Pending Review' | string;
export type ReviewVerdict = 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review' | 'Approved with Notes' | string;
export interface ReviewClientInfo {
  id?: string;
  name?: string;
  representative?: string;
  email?: string;
  avatar?: string;
  [key: string]: any;
}
export interface ReviewVendorInfo {
  id?: string;
  name?: string;
  lead_name?: string;
  email?: string;
  [key: string]: any;
}
export interface ReviewAnnotation {
  id: string;
  frame_number?: number;
  frame?: number;
  time_seconds?: number;
  drawing_data?: string;
  comment?: string;
  author_id?: string;
  author_name?: string;
  author_avatar?: string;
  color?: string;
  created_at?: string;
  [key: string]: any;
}
export type Annotation = ReviewAnnotation;
export interface ReviewComment {
  id: string;
  author_id?: string;
  author_name?: string;
  author?: any;
  author_avatar?: string;
  author_role?: string;
  content?: string;
  text?: string;
  created_at?: string;
  frame_number?: number;
  timecode?: string;
  is_internal?: boolean;
  is_resolved?: boolean;
  is_client_visible?: boolean;
  tags?: string[];
  replies?: any[];
  [key: string]: any;
}
export interface ReviewNote {
  id: string;
  category?: 'Supervisor' | 'Client' | 'Director' | 'Internal' | string;
  content: string;
  author_id?: string;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  is_pinned?: boolean;
  created_at?: string;
  [key: string]: any;
}
export interface ReviewParticipant {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  department?: string;
  status?: 'Active' | 'Invited' | 'Left' | string;
  joined_at?: string;
  [key: string]: any;
}
export interface ReviewVersionRef {
  id: string;
  version_id?: string;
  version_code?: string;
  version_number?: string | number;
  thumbnail_url?: string;
  media_url?: string;
  entity_type?: 'Shot' | 'Asset' | string;
  entity_code?: string;
  verdict?: ReviewVerdict;
  status?: ProductionStatus | string;
  notes_count?: number;
  annotations_count?: number;
  [key: string]: any;
}
export type ReviewVersion = ReviewVersionRef;
export interface ReviewActivity extends BaseEntity {
  id: string;
  review_id?: string;
  action: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  timestamp?: string;
  details?: string;
  [key: string]: any;
}
export interface ReviewSession extends BaseEntity {
  name?: string;
  title?: string;
  code?: string;
  project_id: string;
  project_code?: string;
  status: ReviewStatus;
  scheduled_at?: string;
  leader_id?: string;
  leader_name?: string;
  attendee_ids?: string[];
  playlist_id?: string;
  current_version_id?: string;
  notes?: string | ReviewNote[] | any;
  annotations?: ReviewAnnotation[];
  comments?: ReviewComment[];
  participants?: ReviewParticipant[];
  versions?: ReviewVersionRef[];
  activities?: ReviewActivity[];
  verdict?: ReviewVerdict;
  client?: ReviewClientInfo;
  vendor?: ReviewVendorInfo;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from publishing.ts
// ---------------------------------------------------------------------------

export type PublishStatus =
  | 'Published'
  | 'Pending'
  | 'Validating'
  | 'Failed'
  | 'Unpublished'
  | 'Republished'
  | string;
export interface PublishDestination {
  id: string;
  name: string;
  type: string;
  path: string;
  protocol: string;
  is_default?: boolean;
  region?: string;
  [key: string]: any;
}
export interface PublishActivity extends BaseEntity {
  id: string;
  publish_id?: string;
  action: string;
  user_name?: string;
  user_avatar?: string;
  timestamp?: string;
  details?: string;
  [key: string]: any;
}
export interface PublishValidationRule {
  id: string;
  name: string;
  category?: string;
  status: 'passed' | 'failed' | 'warning' | string;
  message?: string;
  [key: string]: any;
}
export interface PublishItem extends BaseEntity {
  id: string;
  publish_code?: string;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  entity_type?: 'Shot' | 'Asset' | string;
  entity_id?: string;
  entity_code?: string;
  entity_name?: string;
  task_id?: string;
  task_name?: string;
  version_id?: string;
  version_number?: string | number;
  artist_id?: string;
  artist_name?: string;
  artist_avatar?: string;
  department?: string;
  destination?: PublishDestination;
  status?: PublishStatus;
  dcc_software?: string;
  dcc_version?: string;
  dcc_file_path?: string;
  output_path?: string;
  frame_range?: string;
  total_frames?: number;
  fps?: number;
  resolution?: string;
  file_count?: number;
  total_size_bytes?: number;
  total_size_formatted?: string;
  checksum_sha256?: string;
  color_space?: string;
  validation_passed?: boolean;
  republish_count?: number;
  published_at?: string;
  thumbnail_url?: string;
  comment?: string;
  validation_rules?: PublishValidationRule[];
  activities?: PublishActivity[];
  [key: string]: any;
}
export interface PublishTarget {
  target_id: string;
  target_type: 'USD_Stage' | 'Shotgun' | 'Editorial' | 'Review_Playlist' | 'NAS_Archive' | string;
  path?: string;
  status: 'Pending' | 'Published' | 'Failed' | string;
  error_message?: string;
  [key: string]: any;
}
export interface PublishRecord extends BaseEntity {
  version_id: string;
  version_code: string;
  publisher_id: string;
  publisher_name: string;
  dcc: string;
  targets: PublishTarget[];
  log_summary?: string;
  status: 'In Progress' | 'Success' | 'Failed' | 'Partial' | string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from deliveries.ts
// ---------------------------------------------------------------------------

export type DeliveryStatus =
  | 'Draft'
  | 'Packing'
  | 'Ready'
  | 'In Transit'
  | 'Delivered'
  | 'Accepted'
  | 'Rejected'
  | 'Failed'
  | 'Archived'
  | string;
export type DeliveryDestinationType =
  | 'Aspera Connect'
  | 'AWS S3 Bucket'
  | 'Client SFTP'
  | 'Frame.io Enterprise'
  | string;
export interface DeliveryDestination {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  credentials_configured?: boolean;
  transfer_rate_mbps?: number;
  storage_region?: string;
  port?: number;
  target_directory?: string;
  [key: string]: any;
}
export interface DeliveryMediaFile {
  id?: string;
  filename: string;
  type?: string;
  size_bytes?: number;
  format?: string;
  checksum?: string;
  path?: string;
  [key: string]: any;
}
export interface DeliveryVersionRef {
  id: string;
  version_id?: string;
  version_code?: string;
  entity_type?: string;
  entity_code?: string;
  version_number?: string | number;
  department?: string;
  artist_name?: string;
  resolution?: string;
  fps?: number;
  frame_range?: string;
  duration_frames?: number;
  duration_tc?: string;
  files?: DeliveryMediaFile[];
  status?: string;
  [key: string]: any;
}
export interface DeliveryPackage extends BaseEntity {
  id: string;
  package_id?: string;
  package_code?: string;
  title?: string;
  description?: string;
  project_id?: string;
  project_code?: string;
  project_name?: string;
  client?: any;
  vendor?: any;
  destination?: DeliveryDestination;
  due_date?: string;
  milestone_name?: string;
  status: DeliveryStatus;
  validation_score?: number;
  all_validations_passed?: boolean;
  total_size_bytes?: number;
  total_size_formatted?: string;
  total_shots_count?: number;
  total_frames_count?: number;
  transfer_progress_percent?: number;
  transfer_speed_mbps?: number;
  estimated_completion_time?: string;
  thumbnail_url?: string;
  versions?: DeliveryVersionRef[];
  history?: any[];
  items?: any[];
  item_type?: 'Shot' | 'Asset' | 'Plate' | 'Audio' | 'Document' | string;
  item_id?: string;
  item_code?: string;
  version_code?: string;
  file_path?: string;
  checksum_md5?: string;
  [key: string]: any;
}
export interface Delivery extends DeliveryPackage {
  name?: string;
  code?: string;
  recipient_type?: 'Client' | 'Vendor' | 'Partner' | string;
  recipient_id?: string;
  recipient_name?: string;
  delivery_method?: 'Aspera' | 'Signiant' | 'S3' | 'Hard Drive' | 'FTP' | string;
  tracking_number?: string;
  dispatched_at?: string;
  delivered_at?: string;
  notes?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from bulk.ts
// ---------------------------------------------------------------------------

export type EntityResolutionState =
  | 'NEW'
  | 'SOFT_DELETED'
  | 'EXISTS'
  | 'DUPLICATE_IN_REQUEST'
  | 'INVALID'
  | 'ERROR'
  | string;
export type ResolutionUserAction =
  | 'create'
  | 'recover'
  | 'skip'
  | 'overwrite'
  | 'CREATE'
  | 'OVERWRITE'
  | 'RESTORE'
  | 'RECOVER'
  | 'SKIP'
  | 'AUTO_RENAME'
  | string;
export interface EntityResolutionItem<T = any> {
  code: string;
  name?: string;
  state: EntityResolutionState;
  existingId?: string;
  existingEntity?: T;
  proposedData?: Partial<T>;
  parsedData?: Record<string, any>;
  userAction: ResolutionUserAction;
  newName?: string;
  newCode?: string;
  errorMessage?: string;
  errors?: string[];
  warnings?: string[];
  rowIndex?: number;
  [key: string]: any;
}
export interface BulkOperationSummary {
  total?: number;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  restoredCount?: number;
  recoveredCount?: number;
  skippedCount?: number;
  newCount?: number;
  softDeletedCount?: number;
  existingCount?: number;
  duplicateCount?: number;
  invalidCount?: number;
  [key: string]: any;
}
export interface BulkItemResult<T = any> {
  index?: number;
  code: string;
  id?: string;
  success: boolean;
  actionTaken?: ResolutionUserAction | 'CREATED' | 'UPDATED' | 'RESTORED' | 'SKIPPED' | string;
  entity?: T;
  error?: string;
  suggestedAction?: string;
  [key: string]: any;
}
export type BulkOperationResultItem<T = any> = BulkItemResult<T>;
export interface BulkOperationResponse<T = any> {
  success?: boolean;
  operation_id?: string;
  timestamp?: string;
  partial_success?: boolean;
  summary: BulkOperationSummary;
  results: BulkItemResult<T>[];
  errors?: string[];
  [key: string]: any;
}
export interface BulkUpdateFieldConfig<T = any> {
  key?: string | keyof T;
  label?: string;
  value?: any;
  newValue?: any;
  currentMixed?: boolean;
  currentCommonValue?: any;
  mode?: 'set' | 'append' | 'remove' | 'clear' | string;
  field?: string;
  action?: 'set' | 'append' | 'remove' | 'clear' | string;
  type?: 'text' | 'number' | 'select' | 'boolean' | 'date' | string;
  options?: string[] | { label: string; value: any }[];
  enabled?: boolean;
  [key: string]: any;
}
export interface BulkCreateItem<T = any> {
  code: string;
  action?: ResolutionUserAction;
  data: Partial<T>;
  [key: string]: any;
}
export interface BulkCreateRequest<T = any> {
  project_id?: string;
  projectId?: string;
  items: BulkCreateItem<T>[];
  mode?: 'strict' | 'best_effort';
  [key: string]: any;
}
export interface BulkUpdateRequest<T = any> {
  project_id?: string;
  projectId?: string;
  ids?: string[];
  codes?: string[];
  updates?: Partial<T>;
  fields?: BulkUpdateFieldConfig<T>[];
  [key: string]: any;
}
export interface BulkArchiveRestoreRequest {
  project_id?: string;
  projectId?: string;
  ids?: string[];
  codes?: string[];
  action?: 'archive' | 'restore';
  [key: string]: any;
}
export interface CheckExistencePayload {
  project_id?: string;
  projectId?: string;
  codes: string[];
  [key: string]: any;
}
export interface ExistingEntityInfo<T = any> {
  code: string;
  exists: boolean;
  is_deleted?: boolean;
  isDeleted?: boolean;
  entity?: T;
  id?: string;
  name?: string;
}
export interface CheckExistenceResponse<T = any> {
  results?: Record<string, ExistingEntityInfo<T>> | ExistingEntityInfo<T>[];
  items?: any[];
  existing_codes?: string[];
  deleted_codes?: string[];
  new_codes?: string[];
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from organization.ts (relocated production types, org-free)
// ---------------------------------------------------------------------------

export interface PublishedVersion extends BaseEntity {
  version_number?: number | string;
  code?: string;
  [key: string]: any;
}
export interface ProductionReport extends Partial<BaseEntity> {
  id: string;
  title: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}
