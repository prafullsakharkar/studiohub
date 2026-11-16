import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deliveriesApi } from '@/api/deliveries/deliveries';
import { notificationsApi } from '@/api/notifications/notifications';
import { milestonesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { NotificationsPage } from '@/modules/notifications';
import { live } from './liveBackend';

/**
 * Review-pipeline RP-13 (WP 13.5): notifications beyond reviews against a REAL backend (C-RP-34, C-RP-35), with the
 * roles the studio seeds. The supervisor makes and prepares a delivery; the producer signs it off, sends it and
 * records the client's approval: the supervisor is told each step, the client's answer once, and the producer
 * (who acted) nothing. The supervisor opens the delivery from the Notifications page. The supervisor sets a
 * milestone and the producer completes it: the supervisor is told. Run on a fresh live_backend.py seed (the project
 * and its published versions are made there).
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { delivery: string; code: string; milestone: string };

const Where: React.FC = () => <output aria-label="Location">{useLocation().pathname}</output>;
const tree = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/notifications']}>
      <AuthProvider>
        {ui}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signIn(who: 'supervisor' | 'producer') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const about = async (id: string) => (await notificationsApi.list({ page: 1, page_size: 50, project_id: live.dlv.project })).results.filter((n) => n.target.id === id);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('a delivery tells the people on it', () => {
  it('each step the supervisor waits for is told to them, the client’s answer once, and never to the producer who acted', async () => {
    await signIn('supervisor');
    const d = await deliveriesApi.create({ name: `Notified ${uid}`, project_id: live.dlv.project });
    fixture.delivery = d.id;
    fixture.code = d.code;
    await deliveriesApi.addVersion(d.id, live.dlv.versions[0].id);
    await deliveriesApi.prepare(d.id);
    expect(await about(d.id)).toEqual([]); // the working states tell nobody

    await signIn('producer');
    await deliveriesApi.signOff(d.id);
    await deliveriesApi.submit(d.id, `TR-${uid}`);
    await deliveriesApi.approve(d.id, 'Looks good');
    expect(await about(d.id)).toEqual([]); // whoever acted is never told

    await signIn('supervisor');
    const rows = await about(d.id);
    expect(rows.map((n) => [n.kind, n.data])).toEqual([
      ['delivery_client_answer', { client_status: 'Approved' }],
      ['delivery_status', { from_status: 'Signed Off', to_status: 'Submitted' }],
      ['delivery_status', { from_status: 'Prepared', to_status: 'Signed Off' }],
    ]);
    expect(rows.every((n) => n.target.type === 'delivery' && n.target.code === d.code && n.actor !== null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('Looks good');
  }, 180000);

  it('the supervisor reads the step on the Notifications page and opens the delivery from it', async () => {
    await signIn('supervisor');
    render(tree(<NotificationsPage />));
    const signed = await screen.findByText(new RegExp(`moved the delivery ${fixture.code} Prepared → Signed Off$`), {}, { timeout: 20000 });
    await screen.findByText(`The client's answer on ${fixture.code} was recorded: Approved`);
    expect((await screen.findByLabelText('Delivery steps')) as HTMLInputElement).toHaveProperty('checked', true);
    const row = signed.closest('button') ?? within(signed.parentElement as HTMLElement).getByRole('button');
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/deliveries/${fixture.delivery}`));
  }, 120000);
});

describe('a milestone tells its creator', () => {
  it('the producer completes the supervisor’s milestone: the supervisor is told, by name', async () => {
    await signIn('supervisor');
    const due = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const m = await milestonesApi.create({ project_id: live.dlv.project, name: `Lock ${uid}`, due_date: due });
    fixture.milestone = m.id;

    await signIn('producer');
    await milestonesApi.complete(m.id);
    expect(await about(m.id)).toEqual([]);

    await signIn('supervisor');
    const rows = await about(m.id);
    expect(rows.map((n) => [n.kind, n.target.type, n.target.name, n.data])).toEqual([['milestone_completed', 'milestone', `Lock ${uid}`, {}]]);
    render(tree(<NotificationsPage />));
    const done = await screen.findByText(new RegExp(`completed the milestone “Lock ${uid}”$`), {}, { timeout: 20000 });
    fireEvent.click(done.closest('button') ?? within(done.parentElement as HTMLElement).getByRole('button'));
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/projects/${live.dlv.project}/schedule`));
  }, 180000);
});
