import { describe, expect, it } from 'vitest';
import { DEPARTMENT_KEYS, KPI_KEYS } from '@/api/analytics/analyticsRowKeys';
import type { ProjectCounts } from '@/api/production/structure';
import { loadSample } from '@/test/samples';
import { ProjectDashboardDataSchema } from '../schemas/dashboardSchema';
import * as K from '../types/dashboardRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('dashboards/_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const dash = flow.dashboard.body;

/** Every key of the sample is in the type, and every key the type does not mark optional is in the sample. */
function expectShape(rows: object[], all: object, optional: readonly string[] = []) {
  expect(rows.length).toBeGreaterThan(0);
  const union = new Set(rows.flatMap((r) => Object.keys(r)));
  expect([...union].filter((k) => !(k in all))).toEqual([]);
  expect(Object.keys(all).filter((k) => !optional.includes(k) && !union.has(k))).toEqual([]);
}

describe('the project dashboard payload matches the types', () => {
  it('the top level and every section', () => {
    expect(keys(dash)).toEqual(keys(K.DASHBOARD_KEYS));
    expectShape([dash.project], K.PROJECT_KEYS, K.PROJECT_OPTIONAL);
    expectShape([dash.summary], K.SUMMARY_KEYS);
    expectShape([dash.production], K.PRODUCTION_KEYS);
    expectShape(dash.production.status_breakdown, K.BREAKDOWN_KEYS);
    expectShape([dash.shots], K.SHOTS_KEYS);
    expectShape(dash.shots.recent_shots, K.SHOT_ITEM_KEYS, K.SHOT_ITEM_OPTIONAL);
    expectShape([dash.tasks], K.TASKS_KEYS);
    expectShape(dash.tasks.recent_tasks, K.TASK_ITEM_KEYS, K.TASK_ITEM_OPTIONAL);
    expectShape([dash.reviews], K.REVIEWS_KEYS);
    expectShape(dash.reviews.recent_reviews, K.REVIEW_ITEM_KEYS, K.REVIEW_ITEM_OPTIONAL);
    expectShape([dash.schedule], K.SCHEDULE_KEYS, K.SCHEDULE_OPTIONAL);
    expectShape(dash.schedule.milestones, K.MILESTONE_KEYS);
    expectShape([dash.workload], K.WORKLOAD_KEYS);
    expectShape(dash.workload.team_members, K.WORKLOAD_ITEM_KEYS, K.WORKLOAD_ITEM_OPTIONAL);
    expectShape([dash.deliveries], K.DELIVERIES_KEYS);
    expectShape(dash.deliveries.items, K.DELIVERY_ITEM_KEYS, K.DELIVERY_ITEM_OPTIONAL);
    expectShape(dash.activity, K.ACTIVITY_KEYS, K.ACTIVITY_OPTIONAL);
  });
  it('passes the schema the screen validates it with, for a project with data and for an empty one', () => {
    expect(ProjectDashboardDataSchema.safeParse(dash).success).toBe(true);
    expect(ProjectDashboardDataSchema.safeParse(flow.dashboard_empty.body).success).toBe(true);
  });
  it('is the same payload on the code lookup and on the fallback route', () => {
    expect(flow.dashboard_by_code.body.project.id).toBe(dash.project.id);
    expect(keys(flow.dashboard_fallback_route.body)).toEqual(keys(dash));
    expect(flow.dashboard_fallback_route.body.summary).toEqual(dash.summary);
  });
});

describe('the figures are real aggregates of what was seeded', () => {
  it('shots, tasks, assets, reviews and deliveries', () => {
    expect(dash.summary).toMatchObject({ total_shots: 10, approved_shots: 2, in_progress_shots: 3, shots_at_risk: 1, shots_completion_pct: 20 });
    expect(dash.summary).toMatchObject({ total_tasks: 8, completed_tasks: 2, in_progress_tasks: 3, open_tasks: 2, overdue_tasks: 1, tasks_completion_pct: 25 });
    expect(dash.summary).toMatchObject({ total_assets: 4, approved_assets: 1, needs_revision_assets: 1, in_progress_assets: 2 });
    expect(dash.summary).toMatchObject({ total_reviews: 5, pending_reviews: 1, approved_reviews: 2, changes_requested_reviews: 1, rejected_reviews: 1 });
    expect(dash.summary).toMatchObject({ total_deliveries: 3, upcoming_deliveries: 1, late_deliveries: 1, delivered_deliveries: 0 }); // the cancelled one is neither late nor upcoming
  });
  it('the breakdown of shots by status adds up to the total', () => {
    const total = dash.production.status_breakdown.reduce((n: number, row: any) => n + row.count, 0);
    expect(total).toBe(dash.summary.total_shots);
    expect(Object.values(dash.shots.by_status).reduce((n: number, c: any) => n + c, 0)).toBe(dash.shots.total);
  });
  it('the overall progress is a weighted figure and says how', () => {
    expect(dash.production.methodology_note).toBe('Weighted aggregate: 60% Approved Shots + 40% Completed Tasks');
    expect(dash.production.overall_progress_pct).toBe(Math.round(0.6 * dash.summary.shots_completion_pct + 0.4 * dash.summary.tasks_completion_pct));
  });
  it('the task buckets add up and the workload counts overdue tasks', () => {
    const t = dash.tasks;
    expect(t.open + t.in_progress + t.blocked + t.review + t.completed).toBe(t.total);
    expect(dash.workload.team_members.some((m: any) => m.overdue_count > 0)).toBe(true);
  });
  it('the per-task overdue flag agrees with the count: an Approved task past its date is not overdue (CR-31, applied)', () => {
    const t = dash.tasks;
    const flagged = t.recent_tasks.filter((r: any) => r.is_overdue);
    expect(t.overdue).toBe(1); // only the unfinished one is counted
    expect(flagged).toHaveLength(t.overdue);
    expect(flagged[0].status).toBe('In Progress');
    const approvedPastDate = t.recent_tasks.filter((r: any) => r.status === 'Approved' && r.due_date < '2026-10-30');
    expect(approvedPastDate.length).toBeGreaterThan(0); // the capture does hold finished tasks past their date
    expect(approvedPastDate.every((r: any) => r.is_overdue === false)).toBe(true);
  });
  it('a cancelled delivery past its date is neither late nor upcoming (CR-31, applied)', () => {
    const cancelled = dash.deliveries.items.find((d: any) => d.title === 'Cancelled delivery');
    expect(cancelled.status).toBe('Cancelled');
    expect(dash.deliveries).toMatchObject({ total: 3, late: 1, upcoming: 1, delivered: 0 });
    expect(dash.deliveries.items.filter((d: any) => d.status === 'Draft' && d.due_date < '2026-10-30')).toHaveLength(1);
    const { delivered, late, upcoming, total } = dash.deliveries;
    expect(delivered + late + upcoming + 1).toBe(total); // plus the one cancelled
  });
});

describe('the schedule section: the dates and the milestones are the project’s own (CR-30, applied)', () => {
  it('the dates are the project’s own', () => {
    expect(dash.schedule.start_date).toBe(dash.project.start_date);
    expect(dash.schedule.delivery_date).toBe(dash.project.delivery_date);
    expect(dash.schedule.days_total).toBe(105);
    expect(dash.schedule.days_remaining).toBe(dash.schedule.days_total - dash.schedule.days_elapsed);
  });
  it('the milestones are the ones Scheduling holds for the project (same ids, names and dates), with the status as completed, in_progress, overdue or upcoming', () => {
    const real = flow.project_schedule.body.milestones;
    expect(dash.schedule.milestones.map((m: any) => [m.id, m.name, m.date]).sort()).toEqual(real.map((m: any) => [m.id, m.name, m.date]).sort());
    const byName = Object.fromEntries(dash.schedule.milestones.map((m: any) => [m.name, m.status]));
    expect(byName).toEqual({ 'Previs lock': 'completed', Turnover: 'upcoming' });
  });
  it('an empty project has no milestones, and its dates still default', () => {
    const empty = flow.dashboard_empty.body.schedule;
    expect(empty.milestones).toEqual([]);
    expect(empty.days_total).toBe(180); // dates default when the project has none
  });
  it('"delayed" is a rule (a late delivery or more than two overdue tasks), not a comparison with a plan', () => {
    expect(dash.schedule.is_delayed).toBe(true);
    expect(flow.dashboard_empty.body.schedule.is_delayed).toBe(false);
  });
});

describe('statistics and summary', () => {
  it('statistics are the counts the dashboard shows', () => {
    const counts: Record<keyof ProjectCounts, true> = { approved_shots: true, assets: true, completed_tasks: true, deliveries: true, editorial: true, in_progress_shots: true, notes: true, reviews: true, sequences: true, shots: true, tasks: true, versions: true };
    expect(keys(flow.statistics.body)).toEqual(keys(counts));
    expect(flow.statistics.body).toMatchObject({ shots: 10, tasks: 8, assets: 4, reviews: 5, deliveries: 3, approved_shots: 2, completed_tasks: 2 });
    expect(flow.summary.body.counts).toEqual(flow.statistics.body);
  });
  it('summary is the project, its counts and its id', () => {
    expect(keys(flow.summary.body)).toEqual(['counts', 'project', 'project_id']);
    expect(flow.summary.body.project_id).toBe(dash.project.id);
  });
  it('an empty project has zeros everywhere, not a missing section', () => {
    expect(Object.values(flow.statistics_empty.body).every((n) => n === 0)).toBe(true);
    expect(flow.dashboard_empty.body.summary.total_shots).toBe(0);
    expect(flow.dashboard_empty.body.production.overall_progress_pct).toBe(0);
  });
});

describe('who may read', () => {
  it('a member, a supervisor and an administrator read it; someone in no project gets a 404; a user with no role a 403', () => {
    for (const key of ['dashboard', 'dashboard_supervisor', 'dashboard_artist', 'statistics_artist', 'summary_artist', 'dashboard_fallback_route_artist']) expect(flow[key].status).toBe(200);
    for (const key of ['dashboard_stranger', 'statistics_stranger', 'summary_stranger', 'dashboard_fallback_route_stranger', 'dashboard_unknown']) expect(flow[key].status).toBe(404);
    expect(flow.dashboard_norole.status).toBe(403);
  });
});

describe('analytics', () => {
  it('kpis match the type, are aggregates of the seeded shots, and leave what has no source null', () => {
    expect(keys(flow.analytics_kpis.body)).toEqual(keys(KPI_KEYS));
    expect(flow.analytics_kpis.body).toMatchObject({ total_active_projects: 2, total_shots: 10, approved_shots: 2, in_progress_shots: 3, pending_review_shots: 1, approval_rate_percentage: 20, active_artists: 2 });
    for (const field of ['render_nodes_busy', 'render_nodes_total', 'average_render_time_mins']) expect(flow.analytics_kpis.body[field]).toBeNull();
    expect(flow.analytics_kpis.body.storage_quota_tb).toBe(0); // zero for "no telemetry", not for "no storage"
  });
  it('departments match the type and count only tasks that have a department', () => {
    for (const row of items('analytics_departments')) expect(keys(row)).toEqual(keys(DEPARTMENT_KEYS));
    expect(items('analytics_departments')).toEqual([
      { department: 'Compositing', total_tasks: 4, completed_tasks: 1, percentage: 25 },
      { department: 'Lighting', total_tasks: 3, completed_tasks: 1, percentage: 33 },
    ]);
  });
  it('are narrowed to the caller’s projects: the same figures for a member, zeros for someone in none, and every signed-in user is answered', () => {
    expect(flow.analytics_kpis_artist.body.total_shots).toBe(10);
    expect(flow.analytics_kpis_stranger.body).toMatchObject({ total_shots: 0, total_active_projects: 0, active_artists: 0 });
    expect(flow.analytics_kpis_norole.status).toBe(200);
    expect(items('analytics_departments_stranger')).toEqual([]);
    expect(items('analytics_departments_artist')).toHaveLength(2);
    expect(flow.analytics_kpis_empty.body.total_active_projects).toBe(1);
  });
  it('are read-only', () => {
    expect(flow.analytics_kpis_post.status).toBe(405);
  });
});
