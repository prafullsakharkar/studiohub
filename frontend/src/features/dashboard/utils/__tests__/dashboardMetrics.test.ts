import { describe, it, expect } from 'vitest';
import {
  formatActivityTimestamp,
  getCategoryComparison,
  getTaskFigures,
  taskIsOverdue,
  getTaskStatusDistribution,
} from '../dashboardMetrics';
import type { DashboardSummaryKpis, DashboardTasksData } from '../../types';

const summary = (over: Partial<DashboardSummaryKpis> = {}): DashboardSummaryKpis => ({
  total_shots: 0,
  approved_shots: 0,
  in_progress_shots: 0,
  shots_at_risk: 0,
  shots_completion_pct: 0,
  total_tasks: 0,
  open_tasks: 0,
  in_progress_tasks: 0,
  completed_tasks: 0,
  overdue_tasks: 0,
  tasks_completion_pct: 0,
  total_assets: 0,
  in_progress_assets: 0,
  approved_assets: 0,
  needs_revision_assets: 0,
  pending_reviews: 0,
  approved_reviews: 0,
  changes_requested_reviews: 0,
  upcoming_deliveries: 0,
  delivered_deliveries: 0,
  late_deliveries: 0,
  ...over,
});

const tasks = (over: Partial<DashboardTasksData> = {}): DashboardTasksData => ({
  total: 0,
  open: 0,
  in_progress: 0,
  blocked: 0,
  review: 0,
  completed: 0,
  overdue: 0,
  recent_tasks: [],
  ...over,
});

describe('getTaskStatusDistribution', () => {
  it('partitions exact buckets that sum to the project total', () => {
    const segments = getTaskStatusDistribution(
      tasks({ total: 10, open: 2, in_progress: 3, blocked: 1, review: 1, completed: 3, overdue: 2 }),
    );
    expect(segments.map((s) => s.count)).toEqual([2, 3, 1, 3, 1]);
    expect(segments.reduce((n, s) => n + s.count, 0)).toBe(10);
  });

  it('uses an explicit Other bucket instead of invented values without tasksData', () => {
    const segments = getTaskStatusDistribution(
      undefined,
      summary({ total_tasks: 10, open_tasks: 2, in_progress_tasks: 3, completed_tasks: 3 }),
    );
    const byName = Object.fromEntries(segments.map((s) => [s.name, s.count]));
    expect(byName).toEqual({ Open: 2, 'In Progress': 3, Completed: 3, Other: 2 });
    expect(segments.reduce((n, s) => n + s.count, 0)).toBe(10);
  });

  it('returns all zeros for an empty scope', () => {
    const segments = getTaskStatusDistribution(tasks(), summary());
    expect(segments.every((s) => s.count === 0)).toBe(true);
  });
});

describe('getCategoryComparison', () => {
  it('reads every cell from the payload without sample literals', () => {
    const rows = getCategoryComparison(
      summary({
        total_shots: 4, in_progress_shots: 1, approved_shots: 2, shots_at_risk: 0,
        total_assets: 2, in_progress_assets: 1, approved_assets: 1, needs_revision_assets: 0,
        total_reviews: 3, pending_reviews: 2, approved_reviews: 0,
        changes_requested_reviews: 1, rejected_reviews: 0,
      }),
      tasks({ total: 4, in_progress: 1, review: 0, completed: 1, blocked: 0, overdue: 1 }),
    );
    const byCat = Object.fromEntries(rows.map((r) => [r.category, r]));
    expect(byCat.Shots).toMatchObject({ Total: 4, Active: 1, Completed: 2, Risk: 0 });
    expect(byCat.Tasks).toMatchObject({ Total: 4, Active: 1, Completed: 1, Risk: 1 });
    expect(byCat.Assets).toMatchObject({ Total: 2, Active: 1, Completed: 1, Risk: 0 });
    expect(byCat.Reviews).toMatchObject({ Total: 3, Active: 2, Completed: 0, Risk: 1 });
  });

  it('review segments reconcile with the review total', () => {
    const rows = getCategoryComparison(
      summary({ total_reviews: 5, pending_reviews: 2, approved_reviews: 1, changes_requested_reviews: 1, rejected_reviews: 1 }),
    );
    const reviews = rows.find((r) => r.category === 'Reviews')!;
    expect(reviews.Completed + reviews.Active + reviews.Risk).toBe(reviews.Total);
  });

  it('returns zeros — never literals — when the payload is absent', () => {
    for (const row of getCategoryComparison(undefined, undefined)) {
      expect([row.Total, row.Active, row.Completed, row.Risk]).toEqual([0, 0, 0, 0]);
    }
  });
});

describe('getTaskFigures', () => {
  it('reads the rates and counts from the payload, with no blended score', () => {
    const m = getTaskFigures(
      summary({ total_shots: 4, approved_shots: 2 }),
      tasks({ total: 4, completed: 1, overdue: 1, blocked: 0, open: 2, in_progress: 1, review: 0 }),
    );
    expect(m.shotCompletionRate).toBe(50);
    expect(m.taskCompletionRate).toBe(25);
    expect(m.activeTasks).toBe(3);
    expect(m.overdueCount).toBe(1);
    expect(m).not.toHaveProperty('healthScore');
  });

  it('is all zeros for an empty scope, without NaN or Infinity', () => {
    const m = getTaskFigures(summary(), tasks());
    expect(Object.values(m).every((n) => Number.isFinite(n) && n === 0)).toBe(true);
  });
});

describe('taskIsOverdue', () => {
  it('trusts the flag only for an unfinished task', () => {
    expect(taskIsOverdue({ is_overdue: true, status: 'In Progress' })).toBe(true);
    expect(taskIsOverdue({ is_overdue: true, status: 'Approved' })).toBe(false);
    expect(taskIsOverdue({ is_overdue: true, status: 'Completed' })).toBe(false);
    expect(taskIsOverdue({ is_overdue: true, status: 'done' })).toBe(false);
    expect(taskIsOverdue({ is_overdue: false, status: 'In Progress' })).toBe(false);
    expect(taskIsOverdue({ status: 'Blocked' })).toBe(false);
    expect(taskIsOverdue(undefined)).toBe(false);
  });
});

describe('formatActivityTimestamp', () => {
  it('formats ISO timestamps as a short local time', () => {
    expect(formatActivityTimestamp('2026-09-17T06:12:31.172310Z')).toMatch(/^\d{1,2}:\d{2}( [AP]M)?$/);
  });

  it('renders an em dash for missing or unparseable values', () => {
    expect(formatActivityTimestamp('')).toBe('—');
    expect(formatActivityTimestamp(undefined)).toBe('—');
    expect(formatActivityTimestamp('not-a-date')).toBe('—');
  });
});
