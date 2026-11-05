import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { MilestoneDeliveryField, milestoneFormConfig } from '../records';
import { openPicker, pickEntity } from '@/test/picker';

/** The parts of the captured bodies these tests read: a milestone, a page of deliveries, or a validation error. */
interface Body {
  id: string;
  name: string;
  kind: string;
  count: number;
  next: string | null;
  delivery_package_id: unknown;
  results: Array<{ id: string; code: string; name: string }>;
}
type Captured = { status: number; body: Body };
const flow = loadSample<Record<string, Captured>>('scheduling/_milestone_delivery_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const planner = withCodes('schedule.view', 'schedule.create', 'schedule.manage', 'delivery.view');
// The artist sample holds delivery.view, so take it away to get someone who manages the schedule but may not see deliveries.
const noDeliveries = { ...withCodes('schedule.view', 'schedule.create', 'schedule.manage'), permissions: withCodes('schedule.view', 'schedule.create', 'schedule.manage').permissions.filter((code) => code !== 'delivery.view') } as User;

const ids = flow.ids as unknown as { project: string; delivery: string; delivery_two: string; foreign: string };
const reel = (n: 1 | 2) => flow.project_deliveries.body.results.find((d) => d.code.endsWith(`000${n}`)) as Body['results'][number];
const path = (c: MockCall) => new URL(c.url).pathname;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');
const projectRoute = `/api/organizations/projects/${ids.project}/deliveries/`;

/** The server as captured: the project's deliveries, one delivery's detail, the milestone, and what a write answers. */
const server =
  (write: Captured): ((c: MockCall) => MockReply) =>
  (c) => {
    if (c.method !== 'GET') return { status: write.status, body: write.body };
    if (path(c) === projectRoute) return { body: flow.project_deliveries.body };
    if (path(c).startsWith('/api/v1/deliveries/')) return { body: flow.delivery_detail.body };
    if (path(c).startsWith('/api/v1/scheduling/milestones/')) return { body: flow.detail.body };
    if (path(c) === `/api/v1/projects/${ids.project}/`) return { body: { id: ids.project, code: 'P27', name: 'Milestone picker' } };
    return { body: { count: 0, next: null, previous: null, results: [] } };
  };

function mount(initial: string, user: User, element: React.ReactNode, route = '/m/new') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('what the server decides about a milestone’s delivery (captured)', () => {
  it('pins the rules the form is built on', () => {
    // Only the project's own deliveries count, a blank string is not an id, null and "general" are different things.
    expect(flow.create_foreign_delivery.body.delivery_package_id).toEqual(['Unknown delivery.']);
    expect(flow.create_empty_string.body.delivery_package_id).toEqual(['Must be a valid UUID.']);
    expect(flow.create_null.body.delivery_package_id).toEqual(['A delivery milestone needs a delivery.']);
    expect(flow.create_general_with_delivery.body.delivery_package_id).toEqual(['Only a delivery milestone names a delivery.']);
    // Moving a delivery milestone to the general kind with the field left out is refused; clearing it in the same request works.
    expect(flow.patch_kind_general_alone.status).toBe(400);
    expect(flow.patch_kind_general_alone.body.delivery_package_id).toEqual(['Only a delivery milestone names a delivery.']);
    expect(flow.patch_kind_general_and_null.status).toBe(200);
    expect(flow.after_kind_general_and_null.body.delivery_package_id).toBeNull();
    expect(flow.after_kind_general_and_null.body.kind).toBe('general');
    // The picker's list is the project's, paged, and it searches.
    expect(flow.project_deliveries.body.count).toBe(2);
    expect(flow.project_deliveries_search_nothing.body.count).toBe(0);
    expect(flow.project_deliveries_page_size.body.next).toContain('page=2');
  });
});

describe('the milestone form’s delivery', () => {
  it('lists the project’s deliveries for a delivery milestone, and sends the chosen one', async () => {
    const { calls } = mockFetch(server(flow.create_with_delivery));
    mount(`/m/new?project_id=${ids.project}`, planner, <DirectoryFormPage config={milestoneFormConfig} />);
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Reel 1 due' } });
    fireEvent.change(screen.getByLabelText(/^Due/), { target: { value: '2027-03-01' } });
    expect(screen.queryByLabelText(/^Delivery/)).toBeNull(); // the general kind names none
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'delivery' } });
    const { menu } = await openPicker(/^Delivery/);
    expect(await within(menu).findByRole('option', { name: `${reel(1).code} · ${reel(1).name}` })).toBeTruthy();
    expect(within(menu).getByRole('option', { name: `${reel(2).code} · ${reel(2).name}` })).toBeTruthy();
    expect(calls.some((c) => path(c) === projectRoute)).toBe(true);
    fireEvent.click(within(menu).getByRole('option', { name: `${reel(1).code} · ${reel(1).name}` }));
    fireEvent.click(screen.getByRole('button', { name: /create milestone/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ project_id: ids.project, name: 'Reel 1 due', kind: 'delivery', delivery_package_id: reel(1).id });
  });

  it('will not send a delivery milestone without a delivery', async () => {
    const { calls } = mockFetch(server(flow.create_with_delivery));
    mount(`/m/new?project_id=${ids.project}`, planner, <DirectoryFormPage config={milestoneFormConfig} />);
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Reel 1 due' } });
    fireEvent.change(screen.getByLabelText(/^Due/), { target: { value: '2027-03-01' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'delivery' } });
    await screen.findByLabelText(/^Delivery/);
    fireEvent.click(screen.getByRole('button', { name: /create milestone/i }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(writes(calls)).toHaveLength(0);
  });

  it('offers no picker, and says why, to someone who may not view deliveries', async () => {
    const { calls } = mockFetch(server(flow.create_with_delivery));
    mount(`/m/new?project_id=${ids.project}`, noDeliveries, <DirectoryFormPage config={milestoneFormConfig} />);
    fireEvent.change(await screen.findByLabelText('Kind'), { target: { value: 'delivery' } });
    expect(await screen.findByText(/needs permission to view deliveries/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^Delivery/)).toBeNull();
    expect(calls.some((c) => path(c) === projectRoute)).toBe(false);
  });

  it('shows the saved delivery on edit, and a different one is sent alone', async () => {
    const { calls } = mockFetch(server(flow.patch_other_delivery));
    mount(`/m/${flow.detail.body.id}/edit`, planner, <DirectoryFormPage config={milestoneFormConfig} />, '/m/:id/edit');
    const field = await screen.findByLabelText(/^Delivery/, { selector: 'button' });
    await waitFor(() => expect(field.textContent).toContain(`${reel(1).code} · ${reel(1).name}`));
    await pickEntity(/^Delivery/, `${reel(2).code} · ${reel(2).name}`);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].method).toBe('PATCH');
    expect(writes(calls)[0].body).toEqual({ delivery_package_id: reel(2).id });
  });

  it('gives up the delivery in the same request when a delivery milestone becomes a general one', async () => {
    const { calls } = mockFetch(server(flow.patch_kind_general_and_null));
    mount(`/m/${flow.detail.body.id}/edit`, planner, <DirectoryFormPage config={milestoneFormConfig} />, '/m/:id/edit');
    await screen.findByLabelText(/^Delivery/);
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'general' } });
    expect(screen.queryByLabelText(/^Delivery/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    // Without the null the server answers 400 "Only a delivery milestone names a delivery." (flow.patch_kind_general_alone).
    expect(writes(calls)[0].body).toEqual({ kind: 'general', delivery_package_id: null });
  });

  it('sends nothing about the delivery when only the name changes', async () => {
    const { calls } = mockFetch(server(flow.patch_other_delivery));
    mount(`/m/${flow.detail.body.id}/edit`, planner, <DirectoryFormPage config={milestoneFormConfig} />, '/m/:id/edit');
    const name = (await screen.findByLabelText(/^Name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe(flow.detail.body.name));
    fireEvent.change(name, { target: { value: 'Reel 1 due (final)' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ name: 'Reel 1 due (final)' });
  });

  it('does not send a blank delivery for a general milestone that never had one', async () => {
    const general = flow.after_kind_general_and_null.body;
    const { calls } = mockFetch((c) => (c.method === 'GET' && path(c).startsWith('/api/v1/scheduling/milestones/') ? { body: general } : server(flow.patch_other_delivery)(c)));
    mount(`/m/${general.id}/edit`, planner, <DirectoryFormPage config={milestoneFormConfig} />, '/m/:id/edit');
    const name = (await screen.findByLabelText(/^Name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe(general.name));
    expect(screen.queryByLabelText(/^Delivery/)).toBeNull();
    fireEvent.change(name, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ name: 'Renamed' });
  });

  it('clears the choice when the project changes (a delivery of another project is "Unknown delivery.")', async () => {
    mockFetch(server(flow.create_with_delivery));
    const onChange = vi.fn();
    const view = (project: string) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: planner, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MilestoneDeliveryField project={project} value={ids.delivery} onChange={onChange} />
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    const { rerender } = render(view(ids.project));
    expect(onChange).not.toHaveBeenCalled();
    rerender(view('another-project'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
