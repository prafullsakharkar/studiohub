import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deliveriesApi } from '@/api/deliveries/deliveries';
import { milestonesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { authService } from '@/modules/auth/services/AuthService';
import { milestoneFormConfig } from '@/modules/scheduling/records';
import { live } from './liveBackend';
import { openPicker } from '@/test/picker';

/**
 * A delivery milestone names its delivery through a picker (Phase 27), against a REAL backend: the picker lists the project's
 * deliveries, the chosen one is stored, and moving the milestone to the general kind gives the delivery up in the same
 * request (without the null the server answers 400, captured in docs/sync/samples/scheduling/_milestone_delivery_flow.json).
 * Run on a fresh live_backend.py seed.
 */
const T = { timeout: 20000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { first: string; second: string; firstLabel: string; secondLabel: string; milestone: string };

async function signIn(who: 'supervisor' | 'producer') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

const tree = (initial: string, route: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path={route} element={<DirectoryFormPage config={milestoneFormConfig} />} />
          <Route path="/scheduling/milestones" element={<p>Milestones list</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  await signIn('supervisor');
  const first = await deliveriesApi.create({ name: `Picker A ${uid}`, project_id: live.dlv.project });
  const second = await deliveriesApi.create({ name: `Picker B ${uid}`, project_id: live.dlv.project });
  fixture.first = first.id;
  fixture.second = second.id;
  fixture.firstLabel = `${first.code} · ${first.name}`;
  fixture.secondLabel = `${second.code} · ${second.name}`;
}, 60000);

describe('the milestone form’s delivery picker', () => {
  it('lists the project’s deliveries and stores the one chosen', async () => {
    await signIn('producer');
    render(tree(`/m/new?project_id=${live.dlv.project}`, '/m/new'));
    fireEvent.change(await screen.findByLabelText(/^Name/, undefined, T), { target: { value: `Reel due ${uid}` } });
    fireEvent.change(screen.getByLabelText(/^Due/), { target: { value: '2027-04-01' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'delivery' } });
    const { menu } = await openPicker(/^Delivery/, T);
    expect(await within(menu).findByRole('option', { name: fixture.secondLabel }, T)).toBeTruthy();
    expect(within(menu).getByRole('option', { name: fixture.firstLabel })).toBeTruthy();
    fireEvent.click(within(menu).getByRole('option', { name: fixture.secondLabel }));
    fireEvent.click(screen.getByRole('button', { name: /create milestone/i }));
    await screen.findByText('Milestones list', undefined, T);
    const made = (await milestonesApi.list({ project_id: live.dlv.project, search: `Reel due ${uid}` })).results.find((m) => m.name === `Reel due ${uid}`);
    expect(made).toMatchObject({ kind: 'delivery', delivery_package_id: fixture.second });
    fixture.milestone = (made as { id: string }).id;
  });

  it('shows the saved delivery on edit and gives it up when the milestone becomes a general one', async () => {
    await signIn('producer');
    render(tree(`/m/${fixture.milestone}/edit`, '/m/:id/edit'));
    const field = await screen.findByLabelText(/^Delivery/, { selector: 'button' }, T);
    await waitFor(() => expect(field.textContent).toContain(fixture.secondLabel), T);
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'general' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await screen.findByText('Milestones list', undefined, T);
    expect(await milestonesApi.get(fixture.milestone)).toMatchObject({ kind: 'general', delivery_package_id: null });
  });
});
