import {
  DashboardDeliveriesData,
  DashboardSummaryKpis,
  DashboardTasksData,
} from '../types';

/**
 * Centralized Project Dashboard metric derivations.
 *
 * Every function below is pure and operates ONLY on the project-scoped
 * payload returned for the currently selected project
 * (`ProjectDashboardData`). No globals, no mock literals, no fabricated
 * history — missing inputs degrade to zeros or documented "Other" buckets
 * so charts always reconcile with the underlying project totals.
 */

export interface TaskStatusSegment {
  name: string;
  count: number;
  fill: string;
}

const TASK_SEGMENT_FILLS: Record<string, string> = {
  Open: '#94a3b8',
  'In Progress': '#38bdf8',
  Review: '#818cf8',
  Completed: '#10b981',
  Blocked: '#f43f5e',
  Other: '#64748b',
};

/**
 * Partition of project tasks by status for the distribution pie.
 * With full `tasksData` the segments sum exactly to `total`. Without it
 * (summary-only shape) the unclassified remainder lands in an explicit
 * "Other" bucket instead of invented per-status values.
 */
export function getTaskStatusDistribution(
  tasksData?: DashboardTasksData | null,
  summary?: DashboardSummaryKpis | null,
): TaskStatusSegment[] {
  if (tasksData) {
    return [
      { name: 'Open', count: tasksData.open, fill: TASK_SEGMENT_FILLS.Open },
      { name: 'In Progress', count: tasksData.in_progress, fill: TASK_SEGMENT_FILLS['In Progress'] },
      { name: 'Review', count: tasksData.review, fill: TASK_SEGMENT_FILLS.Review },
      { name: 'Completed', count: tasksData.completed, fill: TASK_SEGMENT_FILLS.Completed },
      { name: 'Blocked', count: tasksData.blocked, fill: TASK_SEGMENT_FILLS.Blocked },
    ];
  }
  const open = summary?.open_tasks ?? 0;
  const inProgress = summary?.in_progress_tasks ?? 0;
  const completed = summary?.completed_tasks ?? 0;
  const total = summary?.total_tasks ?? 0;
  const other = Math.max(0, total - (open + inProgress + completed));
  return [
    { name: 'Open', count: open, fill: TASK_SEGMENT_FILLS.Open },
    { name: 'In Progress', count: inProgress, fill: TASK_SEGMENT_FILLS['In Progress'] },
    { name: 'Completed', count: completed, fill: TASK_SEGMENT_FILLS.Completed },
    { name: 'Other', count: other, fill: TASK_SEGMENT_FILLS.Other },
  ];
}

export interface CategoryComparisonRow {
  category: string;
  Total: number;
  Active: number;
  Completed: number;
  Risk: number;
}

/**
 * Active-vs-completed-vs-at-risk comparison per production domain.
 * All cells come from the payload; absent values are zero (never sample
 * literals). Reviews Risk covers changes-requested + rejected so
 * Completed + Active + Risk reconciles with the review total.
 */
export function getCategoryComparison(
  summary?: DashboardSummaryKpis | null,
  tasksData?: DashboardTasksData | null,
): CategoryComparisonRow[] {
  const pending = summary?.pending_reviews ?? 0;
  const approvedReviews = summary?.approved_reviews ?? 0;
  const changes = summary?.changes_requested_reviews ?? 0;
  const rejected = summary?.rejected_reviews ?? 0;
  return [
    {
      category: 'Shots',
      Total: summary?.total_shots ?? 0,
      Active: summary?.in_progress_shots ?? 0,
      Completed: summary?.approved_shots ?? 0,
      Risk: summary?.shots_at_risk ?? 0,
    },
    {
      category: 'Tasks',
      Total: tasksData?.total ?? summary?.total_tasks ?? 0,
      Active: (tasksData?.in_progress ?? summary?.in_progress_tasks ?? 0) + (tasksData?.review ?? 0),
      Completed: tasksData?.completed ?? summary?.completed_tasks ?? 0,
      Risk: (tasksData?.blocked ?? 0) + (tasksData?.overdue ?? summary?.overdue_tasks ?? 0),
    },
    {
      category: 'Assets',
      Total: summary?.total_assets ?? 0,
      Active: summary?.in_progress_assets ?? 0,
      Completed: summary?.approved_assets ?? 0,
      Risk: summary?.needs_revision_assets ?? 0,
    },
    {
      category: 'Reviews',
      Total: summary?.total_reviews ?? pending + approvedReviews + changes + rejected,
      Active: pending,
      Completed: approvedReviews,
      Risk: changes + rejected,
    },
  ];
}

export interface TaskFigures {
  shotCompletionRate: number;
  taskCompletionRate: number;
  overdueCount: number;
  blockedCount: number;
  inProgressCount: number;
  activeTasks: number;
}

/**
 * Rates and counts read straight from the payload. There is no composite "health score": the only blended figure is
 * the server's own `production.overall_progress_pct`, which says how it is weighted (`methodology_note`). Division is
 * guarded so nothing is ever NaN or Infinity.
 */
export function getTaskFigures(
  summary?: DashboardSummaryKpis | null,
  tasksData?: DashboardTasksData | null,
): TaskFigures {
  const totalShots = summary?.total_shots ?? 0;
  const totalTasks = tasksData?.total ?? summary?.total_tasks ?? 0;
  const approvedShots = summary?.approved_shots ?? 0;
  const completedTasks = tasksData?.completed ?? summary?.completed_tasks ?? 0;
  return {
    shotCompletionRate: totalShots > 0 ? Math.round((approvedShots / totalShots) * 100) : 0,
    taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    overdueCount: tasksData?.overdue ?? summary?.overdue_tasks ?? 0,
    blockedCount: tasksData?.blocked ?? 0,
    inProgressCount: tasksData?.in_progress ?? summary?.in_progress_tasks ?? 0,
    activeTasks: (tasksData?.open ?? 0) + (tasksData?.in_progress ?? 0) + (tasksData?.review ?? 0),
  };
}

export type MilestoneState = 'completed' | 'in_progress' | 'upcoming' | 'overdue';

/** The state a real milestone is shown in: Pending past its date is overdue (the server only has the three statuses). */
export function milestoneState(milestone: { status: string; due_date: string }, now: Date = new Date()): MilestoneState {
  if (milestone.status === 'Completed') return 'completed';
  if (new Date(`${milestone.due_date.slice(0, 10)}T23:59:59`) < now) return 'overdue';
  return milestone.status === 'In Progress' ? 'in_progress' : 'upcoming';
}

/**
 * Safe activity timestamp rendering. The backend always sends ISO strings;
 * unparseable values render as an em dash rather than "Invalid Date".
 */
export function formatActivityTimestamp(timestamp: string | undefined | null): string {
  if (!timestamp) return '—';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ------------------------------------------------------------------------------------------------ deliveries

/** The statuses of a delivery that has gone (the server counts the same words, CR-31). */
const DELIVERED_STATUSES = ['delivered', 'approved', 'sent', 'accepted', 'complete', 'completed', 'signed off'];

/** Deliveries still to go out: not delivered, not cancelled, and not past their date. */
export function upcomingDeliveryItems(deliveries: DashboardDeliveriesData, now: Date = new Date()) {
  return deliveries.items.filter((item) => {
    const status = item.status.toLowerCase();
    return status !== 'cancelled' && !DELIVERED_STATUSES.includes(status) && (!item.due_date || new Date(item.due_date) >= now);
  });
}
