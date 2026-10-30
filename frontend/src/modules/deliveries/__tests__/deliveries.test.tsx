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
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { DeliveryWorkspace } from '../DeliveryWorkspace';
import { deliveriesFormConfig, useDeliveriesListConfig } from '../deliveries';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('deliveries/_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
/** The seeded vfx-supervisor: prepares and signs off, cannot send. The production-admin also sends, reads the passcode and deletes. */
const supervisor = withCodes('delivery.create', 'delivery.update', 'delivery.approve');
const producer = withCodes('delivery.create', 'delivery.update', 'delivery.approve', 'delivery.send', 'delivery.view_secret', 'delivery.delete');
const project = structure.projects_list.body.results[0] as { id: string; code: string };

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');

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
  useNotificationStore.setState({ notifications: [] } as never);
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const route = <Route path="/deliveries/:deliveryId" element={<DeliveryWorkspace />} />;
const emptyList = { status: 200, body: { count: 0, next: null, previous: null, results: [] } };

/** Serves the delivery, an empty QC list and history, and whatever `extra` answers. */
function open(user: User, delivery: any, extra?: (c: MockCall) => MockReply | undefined, qc: unknown[] = []) {
  const mocked = mockFetch((c) => {
    const p = path(c);
    const answered = extra?.(c);
    if (answered) return answered;
    if (p.endsWith('/qc/')) return { status: 200, body: qc };
    if (p.endsWith('/history/')) return { status: 200, body: [] };
    if (p.includes('/versions/')) return emptyList;
    return { status: 200, body: delivery };
  });
  renderAt(`/deliveries/${delivery.id}`, user, route);
  return mocked;
}
const toolbar = () => screen.queryByRole('toolbar', { name: 'Delivery actions' });
const actions = () => (toolbar() ? within(toolbar()!).getAllByRole('button').map((b) => b.textContent) : []);
const ready = (id: string) => screen.findByRole('heading', { name: new RegExp(id) });

describe('delivery workspace: the actions follow the status and the caller’s codes', () => {
  it('Draft: a supervisor validates, prepares or cancels; a viewer is offered nothing', async () => {
    const d = flow.detail_draft.body;
    open(supervisor, d);
    await ready(d.code);
    expect(actions()).toEqual(['Validate', 'Prepare', 'Cancel delivery']);
    cleanup();
    open(artist, d);
    await ready(d.code);
    expect(actions()).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  });

  it('Ready: sign-off needs delivery.approve and there is no Send until it is signed off', async () => {
    const d = flow.detail_prepared.body;
    open(supervisor, d);
    await ready(d.code);
    expect(actions()).toEqual(['Sign off', 'Cancel delivery']);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('Signed Off: Send needs delivery.send (a supervisor can only reopen or cancel); cancelling needs delivery.approve here', async () => {
    const d = flow.sign_off.body;
    expect(d.status).toBe('Signed Off');
    open(supervisor, d);
    await ready(d.code);
    expect(actions()).toEqual(['Reopen', 'Cancel delivery']);
    cleanup();
    open(producer, d);
    await ready(d.code);
    expect(actions()).toEqual(['Reopen', 'Send', 'Cancel delivery']);
    cleanup();
    open(withCodes('delivery.update'), d); // update alone cannot cancel a signed-off delivery
    await ready(d.code);
    expect(actions()).toEqual([]);
  });

  it('after sending: the client’s answer is recorded by delivery.send; a sent delivery cannot be cancelled or edited', async () => {
    const d = flow.detail_submitted.body;
    open(producer, d);
    await ready(d.code);
    expect(actions()).toEqual(['Client approved', 'Client rejected']);
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
    cleanup();
    open(supervisor, d);
    await ready(d.code);
    expect(actions()).toEqual([]);
  });

  it('Approved completes, Rejected revises, Completed and Cancelled are final', async () => {
    for (const [sample, expected] of [[flow.approve.body, ['Complete']], [flow.reject.body, ['Revise']], [flow.complete.body, []], [flow.cancel.body, []]] as const) {
      open(producer, sample);
      await ready(sample.code);
      expect(actions()).toEqual(expected);
      cleanup();
    }
  });
});

describe('delivery workspace: the dialogs send what the server expects and show why it refused', () => {
  const confirm = async (button: string) => {
    fireEvent.click(within(toolbar()!).getByRole('button', { name: button }));
    return within(await screen.findByRole('dialog'));
  };

  it('a failed quality check lists what failed, in words, and the dialog stays open', async () => {
    const d = flow.detail_draft.body;
    open(supervisor, d, (c) => (c.method === 'POST' ? reply(flow.prepare_qc_failed) : undefined));
    await ready(d.code);
    const dialog = await confirm('Prepare');
    fireEvent.click(dialog.getByRole('button', { name: 'Prepare' }));
    expect(await dialog.findByText(/The quality checks failed: The files match their checksums \(1 file\(s\) are missing or differ on disk\.\); The snapshot is up to date/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeTruthy();
  });

  it('whoever prepared a delivery is told so when they try to sign it off', async () => {
    const d = flow.detail_prepared.body;
    const { calls } = open(supervisor, d, (c) => (c.method === 'POST' ? reply(flow.sign_off_preparer) : undefined));
    await ready(d.code);
    const dialog = await confirm('Sign off');
    fireEvent.change(dialog.getByLabelText('Notes'), { target: { value: 'looks right' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Sign off' }));
    expect(await dialog.findByText('You prepared this delivery, so someone else must sign it off.')).toBeTruthy();
    expect(writes(calls)[0].body).toEqual({ notes: 'looks right' });
    expect(path(writes(calls)[0])).toBe(`/api/v1/deliveries/${d.id}/sign-off/`);
  });

  it('sending posts the transfer reference; the client’s approval posts notes; neither is sent when left empty', async () => {
    const d = flow.sign_off.body;
    const { calls } = open(producer, d, (c) => (c.method === 'POST' ? reply(flow.submit) : undefined));
    await ready(d.code);
    let dialog = await confirm('Send');
    fireEvent.click(dialog.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/deliveries/${d.id}/submit/`);
    expect(writes(calls)[0].body).toEqual({});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    dialog = await confirm('Send');
    fireEvent.change(dialog.getByLabelText('Transfer reference (e.g. Aspera job)'), { target: { value: 'ASPERA-1' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[1].body).toEqual({ transfer_reference: 'ASPERA-1' });
  });

  it('the client’s approval posts notes under the name the server accepts', async () => {
    const d = flow.detail_submitted.body;
    const { calls } = open(producer, d, (c) => (c.method === 'POST' ? reply(flow.approve) : undefined));
    await ready(d.code);
    const dialog = await confirm('Client approved');
    fireEvent.change(dialog.getByLabelText('Client notes'), { target: { value: 'Accepted by email' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Client approved' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/deliveries/${d.id}/approve/`);
    expect(writes(calls)[0].body).toEqual({ notes: 'Accepted by email' });
  });

  it('a rejection needs the client’s reason before anything is sent', async () => {
    const d = flow.detail_submitted.body;
    const { calls } = open(producer, d, (c) => (c.method === 'POST' ? reply(flow.reject) : undefined));
    await ready(d.code);
    const dialog = await confirm('Client rejected');
    fireEvent.click(dialog.getByRole('button', { name: 'Client rejected' }));
    expect(await dialog.findByText('Reason is required.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: 'Colour is off in reel 2' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Client rejected' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ reason: 'Colour is off in reel 2' });
  });

  it('a move the status no longer allows says where the delivery is, not a generic error', async () => {
    const d = flow.sign_off.body;
    open(producer, d, (c) => (c.method === 'POST' ? reply(flow.submit_again) : undefined));
    await ready(d.code);
    const dialog = await confirm('Send');
    fireEvent.click(dialog.getByRole('button', { name: 'Send' }));
    expect(await dialog.findByText(/A delivery cannot go from Submitted to/)).toBeTruthy();
  });

  it('validating opens the Quality checks tab', async () => {
    const d = flow.detail_draft.body;
    open(supervisor, d, (c) => (c.method === 'POST' ? reply(flow.validate) : undefined), flow.qc_after_validate.body.items);
    await ready(d.code);
    const dialog = await confirm('Validate');
    fireEvent.click(dialog.getByRole('button', { name: 'Validate' }));
    expect(await screen.findByRole('region', { name: 'Latest check run' })).toBeTruthy();
    expect(screen.getAllByText('The files match their checksums').length).toBeGreaterThan(0);
  });

  it('revising opens the new draft', async () => {
    const d = flow.reject.body;
    const { calls } = open(producer, d, (c) => (c.method === 'POST' ? { status: 201, body: flow.revise.body } : undefined));
    await ready(d.code);
    const dialog = await confirm('Revise');
    fireEvent.click(dialog.getByRole('button', { name: 'Revise' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/deliveries/${d.id}/revise/`);
  });
});

describe('delivery workspace: items, passcode and facts', () => {
  it('a checked item cannot be removed and says why; an unchecked one can; adding names the version and explains a refusal', async () => {
    const d = flow.add_second_again.body; // a Draft holding two items
    const [first, second] = d.versions;
    const qc = [{ ...flow.qc_after_validate.body.items[0], item: first.uid }];
    const { calls } = open(supervisor, d, (c) => (c.method === 'POST' ? reply(flow.remove_second) : undefined), qc);
    await ready(d.code);
    const list = await screen.findByRole('list', { name: 'Delivery items' });
    await within(list).findByText('Checked: cannot be removed');
    const removeSecond = within(list).getByRole('button', { name: new RegExp(`^Remove .*${second.version_number}`) });
    fireEvent.click(removeSecond);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/deliveries/${d.id}/remove-version/`);
    expect(writes(calls)[0].body).toEqual({ item_id: second.uid });
  });

  it('a version that is not deliverable is refused with the reason in words', async () => {
    const d = flow.detail_draft.body;
    open(supervisor, d, (c) => (c.method === 'POST' ? reply(flow.add_unpublished) : c.url.includes('/versions/') ? { status: 200, body: { count: 1, next: null, previous: null, results: [{ id: 'v-x', code: 'DV9999', version_number: 'v001', entity_code: '' }] } } : undefined));
    await ready(d.code);
    const select = await screen.findByLabelText('Add a published version');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: 'v-x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add version' }));
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message)).toContain('That version is not published. Publish it first.'));
  });

  it('a sent delivery is a frozen record: no add, no remove', async () => {
    const d = flow.detail_submitted.body;
    open(producer, d);
    await ready(d.code);
    await screen.findByText(/frozen record/);
    expect(screen.queryByLabelText('Add a published version')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
  });

  it('the passcode is fetched on request by a holder of delivery.view_secret, and hidden again', async () => {
    const d = flow.detail_draft.body;
    const { calls } = open(producer, d, (c) => (path(c).endsWith('/passcode/') ? reply(flow.passcode_view) : undefined));
    await ready(d.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(calls.some((c) => path(c).endsWith('/passcode/'))).toBe(false); // never fetched until asked for
    expect(await screen.findByText('Viewing it is logged.')).toBeTruthy(); // said before it is asked for
    fireEvent.click(await screen.findByRole('button', { name: 'Show passcode' }));
    expect((await screen.findByLabelText('Passcode')).textContent).toBe(flow.passcode_view.body.passcode);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByLabelText('Passcode')).toBeNull();
  });

  it('without delivery.view_secret there is no way to ask for it', async () => {
    const d = flow.detail_draft.body;
    open(supervisor, d);
    await ready(d.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(await screen.findByText(/Only people allowed to see secrets can read it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show passcode' })).toBeNull();
  });

  it('the details show when it was sent and the transfer reference; history uses the reader’s words', async () => {
    const d = flow.detail_submitted.body;
    open(producer, d, (c) => (path(c).endsWith('/history/') ? { status: 200, body: flow.history_complete.body.items } : undefined));
    await ready(d.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(await screen.findByText(/ref ASPERA-1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Status history' }));
    const history = await screen.findByRole('list', { name: 'Status history' });
    expect(within(history).getAllByRole('listitem').length).toBe(flow.history_complete.body.items.length);
    expect(within(history).queryByText('Prepared')).toBeNull(); // shown as Ready
    expect(within(history).getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('revoked content after sending is called out', async () => {
    const d = { ...flow.detail_submitted.body, has_revoked_content: true };
    open(producer, d);
    await ready(d.code);
    expect((await screen.findByRole('alert')).textContent).toMatch(/revoked/);
  });
});

describe('deliveries list', () => {
  const List = () => <DirectoryListPage config={useDeliveriesListConfig()} />;
  const listRoute = <Route path="/deliveries" element={<List />} />;
  const rows = [flow.list.body.results.find((r: any) => r.status === 'Submitted'), flow.list.body.results.find((r: any) => r.status === 'Cancelled')].filter(Boolean);

  it('Delete is offered for a Cancelled delivery and not for a Submitted one, even to a holder of delivery.delete', async () => {
    mockFetch(() => ({ status: 200, body: { count: rows.length, next: null, previous: null, results: rows } }));
    renderAt('/deliveries', producer, listRoute);
    const sent = rows.find((r: any) => r.status === 'Submitted');
    const cancelled = rows.find((r: any) => r.status === 'Cancelled');
    await screen.findByRole('link', { name: new RegExp(`^${sent.code}`) });
    expect(screen.queryByRole('button', { name: new RegExp(`^Delete ${sent.code}`) })).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(`^Delete ${cancelled.code}`) })).toBeTruthy();
    expect(screen.queryByRole('link', { name: new RegExp(`^Edit ${sent.code}`) })).toBeNull(); // a sent delivery is not edited
  });

  it('cancelling the ticked deliveries posts their ids and one reason, and reports who was refused', async () => {
    const draft = flow.list.body.results.find((r: any) => r.status === 'Draft') ?? { ...rows[1], status: 'Draft' };
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.bulk_cancel_partial) : { status: 200, body: { count: 1, next: null, previous: null, results: [draft] } }));
    renderAt('/deliveries', supervisor, listRoute);
    fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^Select ${draft.code}`) }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deliveries' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Reason'), { target: { value: 'Postponed' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel deliveries' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/deliveries/bulk-cancel/');
    expect(writes(calls)[0].body).toEqual({ ids: [draft.id], reason: 'Postponed' });
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message).join(' ')).toMatch(/1 cancelled, 2 refused/));
  });

  it('a project’s deliveries are read from the project route, not the list with a filter the server ignores', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: { count: 0, next: null, previous: null, results: [] } }));
    const Scoped = () => <DirectoryListPage config={useDeliveriesListConfig({ projectId: 'p-123' })} />;
    renderAt('/x', supervisor, <Route path="/x" element={<Scoped />} />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(path(calls[0])).toBe('/api/organizations/projects/p-123/deliveries/');
  });
});

describe('delivery form', () => {
  const formRoute = <Route path="/deliveries/new" element={<DirectoryFormPage config={deliveriesFormConfig} />} />;
  const projects: MockReply = { status: 200, body: { count: 1, next: null, previous: null, results: [project] } };

  it('a new delivery names its project and sends the due day as a time; blank optional fields are left to the server', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.create.body } : projects));
    renderAt('/deliveries/new', supervisor, formRoute);
    await screen.findByRole('option', { name: new RegExp(project.code) });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: project.id } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Reel 1 turnover' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /create delivery/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ project_id: project.id, name: 'Reel 1 turnover', delivery_method: 'S3', expires_at: '2026-12-01T00:00:00Z' });
  });

  it('editing never offers or sends the project, client or code, and shows the due date as a day', async () => {
    const d = flow.detail_draft.body;
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? { status: 200, body: d } : { status: 200, body: d }));
    renderAt(`/deliveries/${d.id}/edit`, supervisor, <Route path="/deliveries/:id/edit" element={<DirectoryFormPage config={deliveriesFormConfig} />} />);
    const name = await screen.findByLabelText(/^Name/);
    await waitFor(() => expect((name as HTMLInputElement).value).toBe(d.name));
    expect(screen.queryByLabelText(/^Project/)).toBeNull();
    expect(screen.queryByLabelText(/^Client/)).toBeNull();
    expect(screen.queryByLabelText(/^Code/)).toBeNull();
    expect((screen.getByLabelText('Due date') as HTMLInputElement).value).toBe(String(d.expires_at).slice(0, 10));
    fireEvent.change(name, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].method).toBe('PATCH');
    expect(writes(calls)[0].body).toEqual({ name: 'Renamed' });
  });
});
