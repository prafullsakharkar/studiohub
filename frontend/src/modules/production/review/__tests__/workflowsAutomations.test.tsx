import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { WorkflowWorkspace } from '../WorkflowWorkspace';
import { automationsFormConfig, useAutomationsListConfig } from '../automations';
import { mediaFormConfig, useMediaListConfig } from '../media';
import { useWorkflowsListConfig, workflowsFormConfig } from '../workflows';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const lead = withCodes('workflow.create', 'workflow.update', 'media.update');
const supervisor = withCodes('workflow.create', 'workflow.update', 'workflow.delete', 'automation.view', 'automation.create', 'automation.update', 'automation.delete');
const project = structure.projects_list.body.results[0] as { id: string; code: string; name: string };

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items });
const path = (c: MockCall) => new URL(c.url).pathname;
const posts = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');
const projects: MockReply = { status: 200, body: { count: 1, next: null, previous: null, results: [project] } };

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
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

const active = flow.workflows_detail.body; // is_active true
const inactive = { ...flow.workflows_clone.body }; // a clone is inactive
const WorkflowsList = () => <DirectoryListPage config={useWorkflowsListConfig()} />;

describe('workflows list', () => {
  const route = <Route path="/workflows" element={<WorkflowsList />} />;

  it('offers Deactivate for an active workflow, Activate for an inactive one, and Clone; each posts to its own action', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.workflows_activate) : { status: 200, body: { count: 2, next: null, previous: null, results: [active, inactive] } }));
    renderAt('/workflows', lead, route);
    await screen.findByRole('button', { name: `Deactivate ${active.code}` });
    expect(screen.getByRole('button', { name: `Activate ${inactive.code}` })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: new RegExp(`^Clone ${active.code}`) }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: `Activate ${inactive.code}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(path(posts(calls)[0])).toBe(`/api/v1/workflows/${inactive.id}/activate/`);
  });

  it('an artist (view only) sees the workflows and no controls', async () => {
    mockFetch(() => ({ status: 200, body: { count: 1, next: null, previous: null, results: [active] } }));
    renderAt('/workflows', artist, route);
    await screen.findByRole('link', { name: new RegExp(`^${active.code}`) });
    expect(screen.queryByRole('button', { name: /^(Activate|Deactivate|Clone) / })).toBeNull();
  });
});

describe('workflow workspace', () => {
  const route = <Route path="/workflows/:workflowId" element={<WorkflowWorkspace />} />;

  it('shows nodes and transitions by label; a dry run says it evaluates nothing', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.workflows_simulate) : { status: 200, body: active }));
    renderAt(`/workflows/${active.id}`, lead, route);
    await screen.findByRole('heading', { name: new RegExp(active.code) });
    expect(screen.getByText('Start (n1) → Comp (n2)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }));
    const result = await screen.findByRole('region', { name: 'Dry run result' });
    expect(within(result).getByText(/Nothing is evaluated/)).toBeTruthy();
    expect(path(posts(calls)[0])).toBe(`/api/v1/workflows/${active.id}/simulate/`);
  });

  it('Clone posts to the clone action; a viewer gets no Activate, Deactivate, Clone or Edit', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.workflows_clone) : { status: 200, body: active }));
    renderAt(`/workflows/${active.id}`, lead, route);
    await screen.findByRole('heading', { name: new RegExp(active.code) });
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(path(posts(calls)[0])).toBe(`/api/v1/workflows/${active.id}/clone/`);
    cleanup();

    mockFetch(() => ({ status: 200, body: active }));
    renderAt(`/workflows/${active.id}`, artist, route);
    await screen.findByRole('heading', { name: new RegExp(active.code) });
    expect(screen.queryByRole('button', { name: /^(Activate|Deactivate|Clone)$/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });
});

describe('workflow form', () => {
  const route = <Route path="/workflows/new" element={<DirectoryFormPage config={workflowsFormConfig} />} />;

  it('refuses nodes that are not a JSON array before sending anything, then sends them parsed', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.workflows_create) : projects));
    renderAt('/workflows/new', supervisor, route);
    await screen.findByRole('option', { name: new RegExp(project.code) });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: project.id } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'CF9' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Comp flow' } });
    for (const [bad, message] of [['{oops', 'Nodes is not valid JSON.'], ['{"id":"n1"}', 'Nodes must be a JSON array.']]) {
      fireEvent.change(screen.getByLabelText('Nodes'), { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
      expect(await screen.findByText(message)).toBeTruthy();
    }
    expect(posts(calls)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Nodes'), { target: { value: '[{"id":"n1","label":"Start","type":"start"}]' } });
    fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].body).toMatchObject({ project: project.id, code: 'CF9', name: 'Comp flow', nodes: [{ id: 'n1', label: 'Start', type: 'start' }] });
    expect(posts(calls)[0].body).not.toHaveProperty('is_active'); // activation goes through activate/deactivate
  });
});

describe('automation rules', () => {
  const rule = flow.automations_rules_detail_ok.body;
  const AutomationsList = () => <DirectoryListPage config={useAutomationsListConfig()} />;
  const listRoute = <Route path="/automations" element={<AutomationsList />} />;

  it('lists the rules and says plainly that none of them runs', async () => {
    mockFetch(() => bare(flow.automations_rules_after));
    renderAt('/automations', supervisor, listRoute);
    await screen.findByText(rule.name);
    expect(screen.getByText(/does not run them yet/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: rule.name })).toBeNull(); // no detail page
    cleanup();

    mockFetch(() => reply(flow.automations_artist_rules));
    renderAt('/automations', artist, listRoute);
    expect((await screen.findAllByText(/permission/i)).length).toBeGreaterThan(0); // 403: the server's refusal is shown
  });

  it('a new rule sends the trigger as an object, with the project it belongs to', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.automations_rules_create_ok.body } : projects));
    renderAt('/automations/new', supervisor, <Route path="/automations/new" element={<DirectoryFormPage config={automationsFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Notify on approve' } });
    fireEvent.change(screen.getByLabelText(/^Event/), { target: { value: 'status_changed' } });
    fireEvent.change(screen.getByLabelText('On'), { target: { value: 'Version' } });
    fireEvent.change(screen.getByLabelText('Only when'), { target: { value: '{"status":"Approved"}' } });
    fireEvent.change(screen.getByLabelText('Actions'), { target: { value: '[{"type":"notify","target":"lead"}]' } });
    await screen.findByRole('option', { name: new RegExp(project.code) });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: project.id } });
    fireEvent.click(screen.getByRole('button', { name: /create automation rule/i }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const body = posts(calls)[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Notify on approve', project_id: project.id, trigger: { event: 'status_changed', entity_type: 'Version', filters: { status: 'Approved' } }, actions: [{ type: 'notify', target: 'lead' }] });
    expect(body).not.toHaveProperty('trigger_event');
  });

  it('editing only the event keeps the stored entity type and filters; the project is not asked for on edit', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? { status: 200, body: rule } : { status: 200, body: rule }));
    renderAt(`/automations/${rule.id}/edit`, supervisor, <Route path="/automations/:id/edit" element={<DirectoryFormPage config={automationsFormConfig} />} />);
    const event = await screen.findByLabelText(/^Event/);
    await waitFor(() => expect((event as HTMLInputElement).value).toBe(rule.trigger.event));
    expect(screen.queryByLabelText(/^Project/)).toBeNull();
    fireEvent.change(event, { target: { value: 'created' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].method).toBe('PATCH');
    expect(posts(calls)[0].body).toEqual({ trigger: { event: 'created', entity_type: rule.trigger.entity_type, filters: rule.trigger.filters } });
  });
});

describe('media', () => {
  const item = flow.media_list.body.items[0];
  const MediaList = () => <DirectoryListPage config={useMediaListConfig()} />;

  it('lists the media from a bare-array response with a link to open it; only a holder of media.update gets Edit', async () => {
    mockFetch(() => bare(flow.media_list));
    renderAt('/media', lead, <Route path="/media" element={<MediaList />} />);
    await screen.findAllByRole('link', { name: 'Open' });
    expect(screen.getAllByRole('link', { name: /^Edit / }).length).toBeGreaterThan(0);
    cleanup();

    mockFetch(() => bare(flow.media_list));
    renderAt('/media', artist, <Route path="/media" element={<MediaList />} />);
    await screen.findAllByRole('link', { name: 'Open' });
    expect(screen.queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(item).toBeTruthy();
  });

  it('a new media item sends the project and the shot or asset it is attached to', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.media_create) : projects));
    renderAt('/media/new', artist, <Route path="/media/new" element={<DirectoryFormPage config={mediaFormConfig} />} />);
    await screen.findByRole('option', { name: new RegExp(project.code) });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: project.id } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Video' } });
    fireEvent.change(screen.getByLabelText('Preview link'), { target: { value: 'https://example.test/ref.mp4' } });
    fireEvent.click(screen.getByRole('button', { name: /create media item/i }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].body).toMatchObject({ project: project.id, entity_type: 'Shot', media_type: 'Video', preview_url: 'https://example.test/ref.mp4' });
  });
});
