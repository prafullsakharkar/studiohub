import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ClientDeliveryHealth } from '../components/ClientDeliveryHealth';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardWidget } from '../components/DashboardWidget';
import { ProjectKpiHud } from '../components/ProjectKpiHud';
import { ScheduleMilestonesWidget } from '../components/ScheduleMilestonesWidget';
import { UpcomingOverdueWidget } from '../components/UpcomingOverdueWidget';
import type { ProjectDashboardData } from '../types';
import { getDeliveryFigures, milestoneState, upcomingDeliveryItems } from '../utils/dashboardMetrics';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('dashboards/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const dash = flow.dashboard.body as ProjectDashboardData;
/** A signed-in user who may not view the schedule. */
const plain = { ...artist, permissions: artist.permissions.filter((p) => !p.startsWith('schedule.')) } as User;
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const bare = (list: any[]): MockReply => ({ status: 200, body: list });
const path = (c: MockCall) => new URL(c.url).pathname;

function renderWith(ui: React.ReactElement, user: User = artist) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('deliveries', () => {
  // the captured project: a Draft due in the future, a Draft past its date and a Cancelled one past its date
  const deliveries = dash.deliveries;

  it('the server leaves a cancelled past-due delivery out of late (CR-31), and counting the listed ones here gives the same figures', () => {
    expect(deliveries).toMatchObject({ total: 3, late: 1, upcoming: 1, delivered: 0 });
    expect(getDeliveryFigures(deliveries, new Date('2026-10-30T12:00:00Z'))).toEqual({ delivered: 0, upcoming: 1, late: 1, counted: true });
  });
  it('a delivered one (any of the finished words) is not upcoming or late, and a cut list falls back to the server’s numbers', () => {
    const base = { ...deliveries, total: 1, items: [{ ...deliveries.items[0], status: 'Completed', due_date: '2020-01-01' }] };
    expect(getDeliveryFigures(base, new Date('2026-10-30'))).toEqual({ delivered: 1, upcoming: 0, late: 0, counted: true });
    expect(getDeliveryFigures({ ...base, total: 9 }, new Date('2026-10-30'))).toMatchObject({ counted: false, late: deliveries.late });
  });
  it('upcoming items leave out cancelled, delivered and past-due ones', () => {
    expect(upcomingDeliveryItems(deliveries, new Date('2026-10-30T12:00:00Z')).map((d) => d.title)).toEqual(['Upcoming delivery']);
  });
  it('the delivery tiles and the KPI card show the counted figures', () => {
    const now = vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    renderWith(<ClientDeliveryHealth deliveries={deliveries} projectId="p" />);
    const late = screen.getByText('Late').parentElement as HTMLElement;
    expect(within(late).getByText('1')).toBeTruthy(); // the cancelled one is no longer counted by the server
    cleanup();
    renderWith(<ProjectKpiHud summary={dash.summary} deliveries={deliveries} projectId="p" />);
    expect(screen.getByText('1 Late')).toBeTruthy();
    now.useRealTimers();
  });
});

describe('the watchlist', () => {
  it('does not call an Approved task past its date overdue (the server’s per-task flag does)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    renderWith(<UpcomingOverdueWidget tasks={dash.tasks} deliveries={dash.deliveries} />);
    const section = screen.getByText(/Attention Needed/).closest('div')!.parentElement as HTMLElement;
    expect(within(section).getByText('Task 2')).toBeTruthy(); // in progress, past its date
    expect(within(section).queryByText('Task 6')).toBeNull(); // approved
    expect(within(section).queryByText('Task 7')).toBeNull();
    expect(within(section).getByText('Task 4')).toBeTruthy(); // blocked
    vi.useRealTimers();
  });
});

describe('the production widget', () => {
  it('shows the server’s weighted overall progress with its method, and no invented health index', () => {
    renderWith(<DashboardWidget summary={dash.summary} tasksData={dash.tasks} production={dash.production} shotsData={dash.shots} projectId="p" />);
    expect(screen.queryByText('Health Index')).toBeNull();
    const tile = screen.getByText('Overall Progress').parentElement as HTMLElement;
    expect(within(tile).getByText(`${dash.production.overall_progress_pct}%`).getAttribute('title')).toBe(dash.production.methodology_note);
  });
});

describe('milestones', () => {
  const real = flow.project_schedule.body.milestones.map((m: any) => ({ id: m.id, name: m.name, due_date: m.date, status: m.status, project_code: 'DSH' }));

  it('lists the project’s own milestones from Scheduling (the payload now carries the same ones, CR-30)', async () => {
    const { calls } = mockFetch((c) => (path(c) === '/api/v1/scheduling/milestones/' ? bare(real) : bare([])));
    renderWith(<ScheduleMilestonesWidget schedule={dash.schedule} projectId="p-1" />, withCodes('schedule.view'));
    expect(await screen.findByText('Turnover')).toBeTruthy();
    expect(screen.getByText('Previs lock')).toBeTruthy();
    expect(dash.schedule.milestones.map((m: any) => m.name).sort()).toEqual(real.map((m: any) => m.name).sort());
    expect(new URL(calls.find((c) => path(c) === '/api/v1/scheduling/milestones/')!.url).searchParams.get('project_id')).toBe('p-1');
  });
  it('asks nothing of someone who cannot view the schedule, and says so', async () => {
    const { calls } = mockFetch(() => bare([]));
    renderWith(<ScheduleMilestonesWidget schedule={dash.schedule} projectId="p-1" />, plain);
    expect(screen.getByText(/visible to people who can view the schedule/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50)); // a request, if one is made, is made by now
    expect(calls.filter((c) => path(c).includes('/scheduling/'))).toHaveLength(0);
  });
  it('says plainly when there are none and offers to add one', async () => {
    mockFetch(() => bare([]));
    renderWith(<ScheduleMilestonesWidget schedule={dash.schedule} projectId="p-1" />, withCodes('schedule.view'));
    expect(await screen.findByText(/no milestones yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add one' }).getAttribute('href')).toBe('/scheduling/milestones/new?project_id=p-1');
  });
  it('a pending milestone past its date is overdue; a completed one never is', () => {
    const now = new Date('2026-10-30T12:00:00Z');
    expect(milestoneState({ status: 'Pending', due_date: '2026-10-18' }, now)).toBe('overdue');
    expect(milestoneState({ status: 'Completed', due_date: '2026-10-18' }, now)).toBe('completed');
    expect(milestoneState({ status: 'In Progress', due_date: '2026-11-09' }, now)).toBe('in_progress');
    expect(milestoneState({ status: 'Pending', due_date: '2026-11-09' }, now)).toBe('upcoming');
    expect(milestoneState({ status: 'Pending', due_date: '2026-10-30' }, now)).toBe('upcoming'); // due today is not late yet
  });
});

describe('the home dashboard without a project', () => {
  it('shows the studio overview from the analytics routes: the figures the server gave, departments with their share, and no render-farm or storage meter', async () => {
    const { calls } = mockFetch((c) => (path(c) === '/api/v1/analytics/kpis/' ? { status: 200, body: flow.analytics_kpis.body } : bare(items('analytics_departments'))));
    renderWith(<DashboardEmptyState />);
    const overview = await screen.findByRole('region', { name: 'Studio overview' });
    const k = flow.analytics_kpis.body;
    await screen.findByText('Active projects');
    const tile = (label: string) => screen.getByText(label).parentElement as HTMLElement;
    expect(within(tile('Active projects')).getByText(String(k.total_active_projects))).toBeTruthy();
    expect(within(tile('Shots')).getByText(String(k.total_shots))).toBeTruthy();
    expect(within(tile('Approval rate')).getByText(`${k.approval_rate_percentage}%`)).toBeTruthy();
    expect(await within(overview).findByText('Compositing')).toBeTruthy();
    expect(within(overview).getByText('1 of 4 · 25%')).toBeTruthy();
    expect(within(overview).queryByText(/render|storage/i)).toBeNull();
    expect(calls.map(path).sort()).toEqual(['/api/v1/analytics/departments/', '/api/v1/analytics/kpis/']);
    await waitFor(() => expect(screen.queryByText(/studio figures could not/i)).toBeNull());
  });
  it('says plainly when no task has a department', async () => {
    mockFetch((c) => (path(c) === '/api/v1/analytics/kpis/' ? { status: 200, body: flow.analytics_kpis_empty.body } : bare([])));
    renderWith(<DashboardEmptyState />);
    expect(await screen.findByText('No task has a department yet.')).toBeTruthy();
  });
});
