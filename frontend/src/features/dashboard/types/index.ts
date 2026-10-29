/**
 * StudioHub Project Dashboard Type Definitions
 * Strict project-scoped data contract for VFX Production Command Center
 */

export interface DashboardProjectMetadata {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  status: string;
  fps: number;
  resolution: string;
  aspect_ratio: string;
  color_space: string;
  start_date: string;
  delivery_date: string;
  thumbnail_url?: string;
  supervisor_name?: string;
  coordinator_name?: string;
  client_name?: string;
  budget_usd?: number;
}

export interface DashboardSummaryKpis {
  total_shots: number;
  approved_shots: number;
  in_progress_shots: number;
  shots_at_risk: number;
  shots_completion_pct: number;
  total_tasks: number;
  open_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_completion_pct: number;
  total_assets: number;
  in_progress_assets: number;
  approved_assets: number;
  needs_revision_assets: number;
  total_reviews?: number;
  pending_reviews: number;
  approved_reviews: number;
  changes_requested_reviews: number;
  /** Rejected reviews (present on real payloads; optional for mock shape). */
  rejected_reviews?: number;
  total_deliveries?: number;
  upcoming_deliveries: number;
  delivered_deliveries: number;
  late_deliveries: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  percentage: number;
}

export interface DashboardProductionProgress {
  overall_progress_pct: number;
  completed_shots: number;
  in_progress_shots: number;
  not_started_shots: number;
  status_breakdown: StatusBreakdownItem[];
  methodology_note: string;
}

export interface DashboardShotItem {
  id: string;
  code: string;
  name?: string;
  sequence_code?: string;
  status: string;
  thumbnail_url?: string;
  assigned_artist_name?: string;
  assigned_artist_avatar?: string;
  due_date?: string;
  frame_count?: number;
  current_version?: string;
}

export interface DashboardShotsData {
  total: number;
  by_status: Record<string, number>;
  recent_shots: DashboardShotItem[];
}

export interface DashboardTaskItem {
  id: string;
  code?: string;
  title: string;
  department: string;
  status: string;
  priority: string;
  assignee_name?: string;
  assignee_avatar?: string;
  due_date?: string;
  is_overdue?: boolean;
}

export interface DashboardTasksData {
  total: number;
  open: number;
  in_progress: number;
  blocked: number;
  review: number;
  completed: number;
  overdue: number;
  /** Exact union of overdue-or-blocked tasks (watchlist header). */
  critical?: number;
  recent_tasks: DashboardTaskItem[];
}

export interface DashboardReviewItem {
  id: string;
  title: string;
  type: string;
  status: string;
  reviewers_count: number;
  scheduled_date?: string;
  updated_at: string;
}

export interface DashboardReviewsData {
  pending: number;
  approved: number;
  changes_requested: number;
  rejected: number;
  recent_reviews: DashboardReviewItem[];
}

export interface MilestoneItem {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'overdue';
}

export interface DashboardScheduleData {
  start_date: string;
  delivery_date: string;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  is_delayed: boolean;
  next_deadline?: {
    title: string;
    date: string;
    days_away: number;
    type: string;
  };
  milestones: MilestoneItem[];
}

export interface WorkloadArtist {
  id: string;
  name: string;
  avatar_url?: string;
  role: string;
  department: string;
  assigned_count: number;
  in_progress_count: number;
  overdue_count: number;
  workload_level: 'normal' | 'high' | 'overloaded';
}

export interface DashboardWorkloadData {
  team_members: WorkloadArtist[];
}

export interface DashboardDeliveryItem {
  id: string;
  title: string;
  package_name: string;
  due_date: string;
  status: string;
  recipient: string;
  item_count?: number;
}

export interface DashboardDeliveriesData {
  total: number;
  upcoming: number;
  delivered: number;
  late: number;
  items: DashboardDeliveryItem[];
}

export interface DashboardActivityItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_code?: string;
  action: string;
  user_name: string;
  user_avatar?: string;
  timestamp: string;
  description: string;
}

export interface ProjectDashboardData {
  project: DashboardProjectMetadata;
  summary: DashboardSummaryKpis;
  production: DashboardProductionProgress;
  shots: DashboardShotsData;
  tasks: DashboardTasksData;
  reviews: DashboardReviewsData;
  schedule: DashboardScheduleData;
  workload: DashboardWorkloadData;
  deliveries: DashboardDeliveriesData;
  activity: DashboardActivityItem[];
}
