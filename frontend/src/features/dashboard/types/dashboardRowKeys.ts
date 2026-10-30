/**
 * Exhaustive field lists for the dashboard payload types in `index.ts`, each with the keys that may be absent. They
 * live outside `__tests__` because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile
 * when this file is compiled. The contract test then compares them with the captured payload.
 */
import type {
  DashboardActivityItem,
  DashboardDeliveriesData,
  DashboardDeliveryItem,
  DashboardProductionProgress,
  DashboardProjectMetadata,
  DashboardReviewItem,
  DashboardReviewsData,
  DashboardScheduleData,
  DashboardShotItem,
  DashboardShotsData,
  DashboardSummaryKpis,
  DashboardTaskItem,
  DashboardTasksData,
  DashboardWorkloadData,
  MilestoneItem,
  ProjectDashboardData,
  StatusBreakdownItem,
  WorkloadArtist,
} from './index';

export const DASHBOARD_KEYS: Record<keyof ProjectDashboardData, true> = { activity: true, deliveries: true, production: true, project: true, reviews: true, schedule: true, shots: true, summary: true, tasks: true, workload: true };
export const PROJECT_KEYS: Record<keyof DashboardProjectMetadata, true> = { aspect_ratio: true, budget_usd: true, client_name: true, code: true, color_space: true, coordinator_name: true, delivery_date: true, description: true, fps: true, id: true, name: true, resolution: true, start_date: true, status: true, supervisor_name: true, thumbnail_url: true, type: true };
export const PROJECT_OPTIONAL = ['budget_usd', 'client_name', 'coordinator_name', 'supervisor_name', 'thumbnail_url'] as const;
export const SUMMARY_KEYS: Record<keyof DashboardSummaryKpis, true> = { approved_assets: true, approved_reviews: true, approved_shots: true, changes_requested_reviews: true, completed_tasks: true, delivered_deliveries: true, in_progress_assets: true, in_progress_shots: true, in_progress_tasks: true, late_deliveries: true, needs_revision_assets: true, open_tasks: true, overdue_tasks: true, pending_reviews: true, rejected_reviews: true, shots_at_risk: true, shots_completion_pct: true, tasks_completion_pct: true, total_assets: true, total_deliveries: true, total_reviews: true, total_shots: true, total_tasks: true, upcoming_deliveries: true };
export const BREAKDOWN_KEYS: Record<keyof StatusBreakdownItem, true> = { count: true, percentage: true, status: true };
export const PRODUCTION_KEYS: Record<keyof DashboardProductionProgress, true> = { completed_shots: true, in_progress_shots: true, methodology_note: true, not_started_shots: true, overall_progress_pct: true, status_breakdown: true };
export const SHOT_ITEM_KEYS: Record<keyof DashboardShotItem, true> = { assigned_artist_avatar: true, assigned_artist_name: true, code: true, current_version: true, due_date: true, frame_count: true, id: true, name: true, sequence_code: true, status: true, thumbnail_url: true };
export const SHOT_ITEM_OPTIONAL = ['assigned_artist_avatar', 'assigned_artist_name', 'current_version', 'due_date'] as const;
export const SHOTS_KEYS: Record<keyof DashboardShotsData, true> = { by_status: true, recent_shots: true, total: true };
export const TASK_ITEM_KEYS: Record<keyof DashboardTaskItem, true> = { assignee_avatar: true, assignee_name: true, code: true, department: true, due_date: true, id: true, is_overdue: true, priority: true, status: true, title: true };
export const TASK_ITEM_OPTIONAL = ['assignee_avatar', 'assignee_name', 'due_date'] as const;
export const TASKS_KEYS: Record<keyof DashboardTasksData, true> = { blocked: true, completed: true, critical: true, in_progress: true, open: true, overdue: true, recent_tasks: true, review: true, total: true };
export const REVIEW_ITEM_KEYS: Record<keyof DashboardReviewItem, true> = { id: true, reviewers_count: true, scheduled_date: true, status: true, title: true, type: true, updated_at: true };
export const REVIEW_ITEM_OPTIONAL = ['scheduled_date'] as const;
export const REVIEWS_KEYS: Record<keyof DashboardReviewsData, true> = { approved: true, changes_requested: true, pending: true, recent_reviews: true, rejected: true };
export const MILESTONE_KEYS: Record<keyof MilestoneItem, true> = { date: true, id: true, name: true, status: true };
export const SCHEDULE_KEYS: Record<keyof DashboardScheduleData, true> = { days_elapsed: true, days_remaining: true, days_total: true, delivery_date: true, is_delayed: true, milestones: true, next_deadline: true, start_date: true };
export const SCHEDULE_OPTIONAL = ['next_deadline'] as const;
export const WORKLOAD_ITEM_KEYS: Record<keyof WorkloadArtist, true> = { assigned_count: true, avatar_url: true, department: true, id: true, in_progress_count: true, name: true, overdue_count: true, role: true, workload_level: true };
export const WORKLOAD_ITEM_OPTIONAL = ['avatar_url'] as const;
export const WORKLOAD_KEYS: Record<keyof DashboardWorkloadData, true> = { team_members: true };
export const DELIVERY_ITEM_KEYS: Record<keyof DashboardDeliveryItem, true> = { due_date: true, id: true, item_count: true, package_name: true, recipient: true, status: true, title: true };
export const DELIVERY_ITEM_OPTIONAL = ['item_count'] as const;
export const DELIVERIES_KEYS: Record<keyof DashboardDeliveriesData, true> = { delivered: true, items: true, late: true, total: true, upcoming: true };
export const ACTIVITY_KEYS: Record<keyof DashboardActivityItem, true> = { action: true, description: true, entity_code: true, entity_id: true, entity_type: true, id: true, timestamp: true, user_avatar: true, user_name: true };
export const ACTIVITY_OPTIONAL = ['entity_code', 'user_avatar'] as const;
