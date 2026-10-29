import { z } from 'zod';

export const DashboardProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  type: z.string(),
  description: z.string().optional().default(''),
  status: z.string(),
  fps: z.number().default(24),
  resolution: z.string().default('4096x2160 (4K DCI)'),
  aspect_ratio: z.string().default('2.39:1'),
  color_space: z.string().default('ACEScg'),
  start_date: z.string(),
  delivery_date: z.string(),
  thumbnail_url: z.string().optional(),
  supervisor_name: z.string().optional(),
  coordinator_name: z.string().optional(),
  client_name: z.string().optional(),
  budget_usd: z.number().optional(),
});

export const DashboardSummaryKpisSchema = z.object({
  total_shots: z.number().default(0),
  approved_shots: z.number().default(0),
  in_progress_shots: z.number().default(0),
  shots_at_risk: z.number().default(0),
  shots_completion_pct: z.number().default(0),
  total_tasks: z.number().default(0),
  open_tasks: z.number().default(0),
  in_progress_tasks: z.number().default(0),
  completed_tasks: z.number().default(0),
  overdue_tasks: z.number().default(0),
  tasks_completion_pct: z.number().default(0),
  total_assets: z.number().default(0),
  in_progress_assets: z.number().default(0),
  approved_assets: z.number().default(0),
  needs_revision_assets: z.number().default(0),
  total_reviews: z.number().optional().default(0),
  pending_reviews: z.number().default(0),
  approved_reviews: z.number().default(0),
  changes_requested_reviews: z.number().default(0),
  rejected_reviews: z.number().optional().default(0),
  total_deliveries: z.number().optional().default(0),
  upcoming_deliveries: z.number().default(0),
  delivered_deliveries: z.number().default(0),
  late_deliveries: z.number().default(0),
});

export const StatusBreakdownItemSchema = z.object({
  status: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export const DashboardProductionProgressSchema = z.object({
  overall_progress_pct: z.number().default(0),
  completed_shots: z.number().default(0),
  in_progress_shots: z.number().default(0),
  not_started_shots: z.number().default(0),
  status_breakdown: z.array(StatusBreakdownItemSchema).default([]),
  methodology_note: z.string().default('Weighted aggregate: 60% Approved Shots + 40% Completed Tasks'),
});

export const DashboardShotItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().optional(),
  sequence_code: z.string().optional(),
  status: z.string(),
  thumbnail_url: z.string().optional(),
  assigned_artist_name: z.string().optional(),
  assigned_artist_avatar: z.string().optional(),
  due_date: z.string().optional(),
  frame_count: z.number().optional(),
  current_version: z.string().optional(),
});

export const DashboardShotsDataSchema = z.object({
  total: z.number().default(0),
  by_status: z.record(z.string(), z.number()).default({}),
  recent_shots: z.array(DashboardShotItemSchema).default([]),
});

export const DashboardTaskItemSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  title: z.string(),
  department: z.string(),
  status: z.string(),
  priority: z.string(),
  assignee_name: z.string().optional(),
  assignee_avatar: z.string().optional(),
  due_date: z.string().optional(),
  is_overdue: z.boolean().optional(),
});

export const DashboardTasksDataSchema = z.object({
  total: z.number().default(0),
  open: z.number().default(0),
  in_progress: z.number().default(0),
  blocked: z.number().default(0),
  review: z.number().default(0),
  completed: z.number().default(0),
  overdue: z.number().default(0),
  critical: z.number().optional(),
  recent_tasks: z.array(DashboardTaskItemSchema).default([]),
});

export const DashboardReviewItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  reviewers_count: z.number().default(0),
  scheduled_date: z.string().optional(),
  updated_at: z.string(),
});

export const DashboardReviewsDataSchema = z.object({
  pending: z.number().default(0),
  approved: z.number().default(0),
  changes_requested: z.number().default(0),
  rejected: z.number().default(0),
  recent_reviews: z.array(DashboardReviewItemSchema).default([]),
});

export const MilestoneItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  status: z.enum(['completed', 'in_progress', 'upcoming', 'overdue']),
});

export const DashboardScheduleDataSchema = z.object({
  start_date: z.string(),
  delivery_date: z.string(),
  days_total: z.number().default(0),
  days_elapsed: z.number().default(0),
  days_remaining: z.number().default(0),
  is_delayed: z.boolean().default(false),
  next_deadline: z
    .object({
      title: z.string(),
      date: z.string(),
      days_away: z.number(),
      type: z.string(),
    })
    .optional(),
  milestones: z.array(MilestoneItemSchema).default([]),
});

export const WorkloadArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar_url: z.string().optional(),
  role: z.string(),
  department: z.string(),
  assigned_count: z.number().default(0),
  in_progress_count: z.number().default(0),
  overdue_count: z.number().default(0),
  workload_level: z.enum(['normal', 'high', 'overloaded']).default('normal'),
});

export const DashboardWorkloadDataSchema = z.object({
  team_members: z.array(WorkloadArtistSchema).default([]),
});

export const DashboardDeliveryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  package_name: z.string(),
  due_date: z.string(),
  status: z.string(),
  recipient: z.string(),
  item_count: z.number().optional(),
});

export const DashboardDeliveriesDataSchema = z.object({
  total: z.number().default(0),
  upcoming: z.number().default(0),
  delivered: z.number().default(0),
  late: z.number().default(0),
  items: z.array(DashboardDeliveryItemSchema).default([]),
});

export const DashboardActivityItemSchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  entity_code: z.string().optional(),
  action: z.string(),
  user_name: z.string(),
  user_avatar: z.string().optional(),
  timestamp: z.string(),
  description: z.string(),
});

export const ProjectDashboardDataSchema = z.object({
  project: DashboardProjectMetadataSchema,
  summary: DashboardSummaryKpisSchema,
  production: DashboardProductionProgressSchema,
  shots: DashboardShotsDataSchema,
  tasks: DashboardTasksDataSchema,
  reviews: DashboardReviewsDataSchema,
  schedule: DashboardScheduleDataSchema,
  workload: DashboardWorkloadDataSchema,
  deliveries: DashboardDeliveriesDataSchema,
  activity: z.array(DashboardActivityItemSchema).default([]),
});
