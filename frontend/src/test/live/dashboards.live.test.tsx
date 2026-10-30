import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyticsApi } from '@/api/analytics/analytics';
import { apiClient } from '@/api/client/ApiClient';
import { projectsApi } from '@/api/production/structure';
import { milestonesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { DashboardPage } from '@/modules/dashboard';
import { authService } from '@/modules/auth/services/AuthService';
import { live } from './liveBackend';

/**
 * Phase 12 against a REAL backend, with the roles the studio seeds. A producer opens the project dashboard and sees
 * the project's own milestones from Scheduling (the payload carries the same ones, CR-30); an artist opens the home
 * dashboard with no project chosen and sees the studio overview, the same figures the analytics routes return; the
 * dashboard's own counts reconcile with the statistics route. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();

const tree = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signIn(who: 'producer' | 'artist') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

beforeEach(() => {
  localStorage.clear();
  useProductionStore.getState().setActiveProject(null);
});
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('the project dashboard', () => {
  it('a producer sees the project’s own milestones, and the counts agree with the statistics route', async () => {
    await signIn('producer');
    const project = await projectsApi.get(live.dlv.project);
    const milestone = await milestonesApi.create({ project_id: live.dlv.project, name: `Turnover ${uid}`, due_date: '2027-06-01' });
    expect(milestone.project).toBe(live.dlv.project);

    const dashboard = await apiClient.get<any>(`/api/v1/projects/${live.dlv.project}/dashboard/`);
    const counts = await projectsApi.statistics(live.dlv.project);
    expect(dashboard.summary.total_shots).toBe(counts.shots);
    expect(dashboard.summary.total_tasks).toBe(counts.tasks);
    expect(dashboard.summary.total_reviews).toBe(counts.reviews);
    expect(dashboard.summary.total_assets).toBe(counts.assets);
    expect(dashboard.summary.total_deliveries).toBe(counts.deliveries);
    // the payload's milestones are the project's own (CR-30): the one just made is among them, no invented phases
    expect(dashboard.schedule.milestones).toEqual(expect.arrayContaining([expect.objectContaining({ id: milestone.id, name: `Turnover ${uid}`, date: '2027-06-01', status: 'upcoming' })]));
    expect(dashboard.schedule.milestones.map((m: any) => m.id)).not.toContain('m1');

    useProductionStore.getState().setActiveProject(live.dlv.project);
    render(tree(<DashboardPage />));
    expect(await screen.findByRole('heading', { name: new RegExp(project.name) }, { timeout: 20000 })).toBeTruthy();
    const widget = await waitFor(() => {
      const el = document.getElementById('dashboard-schedule-widget');
      if (!el) throw new Error('schedule widget not drawn yet');
      return el;
    }, { timeout: 20000 });
    expect(await within(widget).findByText(`Turnover ${uid}`, {}, { timeout: 20000 })).toBeTruthy();
  }, 240000);
});

describe('the home dashboard', () => {
  it('an artist with no project chosen sees the studio overview, with the figures the analytics routes return', async () => {
    await signIn('artist');
    const kpis = await analyticsApi.kpis();
    const departments = await analyticsApi.departments();
    expect(kpis.total_active_projects).toBeGreaterThan(0); // the artist belongs to the live project
    expect(kpis.render_nodes_total).toBeNull();

    render(tree(<DashboardPage />));
    const overview = await screen.findByRole('region', { name: 'Studio overview' }, { timeout: 20000 });
    const tile = async (label: string) => (await within(overview).findByText(label, {}, { timeout: 20000 })).parentElement as HTMLElement;
    expect(within(await tile('Active projects')).getByText(String(kpis.total_active_projects))).toBeTruthy();
    expect(within(await tile('Shots')).getByText(String(kpis.total_shots))).toBeTruthy();
    for (const row of departments) expect(await within(overview).findByText(row.department, {}, { timeout: 20000 })).toBeTruthy();
    expect(within(overview).queryByText(/render|storage/i)).toBeNull();
  }, 240000);
});
