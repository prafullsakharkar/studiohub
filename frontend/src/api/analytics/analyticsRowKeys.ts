/** Exhaustive field lists for the types in `analytics.ts` (compiled, so an added or removed field fails `tsc`). */
import type { DepartmentAnalytics, ProductionKpis } from './analytics';

export const KPI_KEYS: Record<keyof ProductionKpis, true> = { active_artists: true, approval_rate_percentage: true, approved_shots: true, average_render_time_mins: true, in_progress_shots: true, pending_review_shots: true, render_nodes_busy: true, render_nodes_total: true, storage_quota_tb: true, storage_usage_tb: true, total_active_projects: true, total_shots: true };
export const DEPARTMENT_KEYS: Record<keyof DepartmentAnalytics, true> = { completed_tasks: true, department: true, percentage: true, total_tasks: true };
