/**
 * CR-60: a project's one client and its vendors, and the screens that may name only those: the delivery's client,
 * the task's vendor and who a project member works for. Every response is captured from the backend
 * (`docs/sync/tools/test_capture_project_partners_cr60.py`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { deliveriesFormFields } from '@/modules/deliveries/deliveries';
import type { FieldDef } from '@/modules/directory/types';
import { MembersPanel } from '@/modules/production/structure/panels';
import { ProjectClientSelect, ProjectVendorSelect } from '@/modules/production/work/pickers';
import { tasksFormFields } from '@/modules/production/work/tasks';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { pickEntity } from '@/test/picker';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_project_partners_cr60_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;
const ids = flow.ids as unknown as Record<'acme' | 'north' | 'ember' | 'project' | 'project_bare', string>;
const PID = ids.project;
const BARE = ids.project_bare;

const path = (c: MockCall) => new URL(c.url).pathname;
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });

// The captured members are a client's, a vendor's and a studio member; their names are redacted, so they get names here.
const [clientMember, vendorMember, studioMember] = (flow.members_list.body.results as Array<Record<string, unknown>>).map((m, i) => ({
  ...m,
  name: ['Cleo Client', 'Vic Vendor', 'Sam Studio'][i],
}));
const members = { count: 3, results: [clientMember, vendorMember, studioMember] };
// The add form picks a directory person with a login (captured for CR-57).
const cr57 = loadSample<Record<string, Captured>>('production/_member_name_cr57_flow.json');
const newcomer = cr57.people_has_user.body.results[0] as { id: string; user: string };

let custom: (c: MockCall) => MockReply | undefined;
const server = (c: MockCall): MockReply => {
  const own = custom(c);
  if (own) return own;
  if (path(c) === `/api/v1/projects/${PID}/`) return reply(flow.project_detail);
  if (path(c) === `/api/v1/projects/${BARE}/`) return reply(flow.project_bare);
  if (path(c) === `/api/organizations/projects/${PID}/members/`) return c.method === 'POST' ? reply(flow.member_add_vendor) : { body: members };
  if (c.method === 'PATCH') return reply(flow.member_patch_vendor);
  if (path(c) === '/api/v1/people/') return reply(cr57.people_has_user);
  if (path(c) === `/api/v1/people/${newcomer.id}/`) return { body: newcomer };
  if (path(c) === '/api/v1/positions/') return reply(cr57.positions);
  return { body: { count: 0, next: null, previous: null, results: [] } };
};

function mount(ui: React.ReactNode, user: User = superuser) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** A form field as the form page renders it, with its own value. */
const FieldHarness: React.FC<{ field: FieldDef; values: Record<string, string>; start?: string; seen?: (v: string) => void }> = ({ field, values, start = '', seen }) => {
  const [value, setValue] = useState(start);
  if (field.kind !== 'entity') throw new Error('not an entity field');
  return (
    <>
      {field.render({ values, value, onChange: (next) => { setValue(next); seen?.(next); } })}
      <output data-testid="value">{value}</output>
    </>
  );
};
const fieldNamed = (fields: ReadonlyArray<FieldDef>, name: string) => fields.find((f) => f.name === name) as FieldDef;
const optionLabels = (select: HTMLElement) => Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);

beforeEach(() => {
  custom = () => undefined;
  useNotificationStore.setState({ notifications: [], recentDedupKeys: new Map() } as never);
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('a task’s vendor', () => {
  it('offers only the project’s vendors, and in house', async () => {
    mockFetch(server);
    mount(<FieldHarness field={fieldNamed(tasksFormFields, 'vendor_id')} values={{ project: PID }} />);
    const select = await screen.findByLabelText('Vendor');
    await waitFor(() => expect(optionLabels(select)).toEqual(['— In house —', 'Northlight', 'Ember FX']));
    fireEvent.change(select, { target: { value: ids.ember } });
    expect(screen.getByTestId('value').textContent).toBe(ids.ember);
  });

  it('says so, with a link to the project’s form, when the project has no vendors', async () => {
    mockFetch(server);
    mount(<ProjectVendorSelect projectId={BARE} value="" onChange={vi.fn()} />);
    expect(await screen.findByText('This project has no vendors.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit the project' }).getAttribute('href')).toBe(`/projects/${BARE}/edit`);
    expect(optionLabels(screen.getByLabelText('Vendor'))).toEqual(['— In house —']);
  });

  it('keeps showing a vendor that has left the project instead of changing it silently', async () => {
    mockFetch(server);
    mount(<ProjectVendorSelect projectId={PID} value="0f0f0f0f-0000-4000-8000-000000000000" onChange={vi.fn()} />);
    await waitFor(() => expect(optionLabels(screen.getByLabelText('Vendor'))).toContain('A vendor no longer on the project'));
    expect((screen.getByLabelText('Vendor') as HTMLSelectElement).value).toBe('0f0f0f0f-0000-4000-8000-000000000000');
  });

  it('waits for a project', () => {
    mockFetch(server);
    mount(<ProjectVendorSelect projectId={undefined} value="" onChange={vi.fn()} />);
    const select = screen.getByLabelText('Vendor') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(optionLabels(select)).toEqual(['Choose a project first']);
  });
});

describe('a delivery’s client', () => {
  it('is the project’s client, filled in when the project is picked', async () => {
    mockFetch(server);
    mount(<FieldHarness field={fieldNamed(deliveriesFormFields, 'client_id')} values={{ project_id: PID }} />);
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe(ids.acme));
    expect(optionLabels(screen.getByLabelText('Client'))).toEqual(['— No client —', 'Acme Pictures']);
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: '' } });
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('offers none, and says where to set it, when the project has no client', async () => {
    mockFetch(server);
    mount(<ProjectClientSelect projectId={BARE} value="" onChange={vi.fn()} />);
    expect(await screen.findByText('Set the project’s client first.')).toBeTruthy();
    expect((screen.getByLabelText('Client') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Edit the project' }).getAttribute('href')).toBe(`/projects/${BARE}/edit`);
  });
});

describe('who a project member works for', () => {
  const worksFor = async (name: string) => (await screen.findByRole('combobox', { name: `Works for, ${name}` })) as HTMLSelectElement;

  it('shows the studio, the project’s client and its vendors for each member', async () => {
    mockFetch(server);
    mount(<MembersPanel projectId={PID} />);
    const client = await worksFor('Cleo Client');
    await waitFor(() => expect(client.selectedOptions[0].textContent).toBe('Client: Acme Pictures'));
    expect((await worksFor('Vic Vendor')).selectedOptions[0].textContent).toBe('Vendor: Ember FX');
    expect((await worksFor('Sam Studio')).selectedOptions[0].textContent).toBe('Studio');
    expect(optionLabels(client)).toEqual(['Studio', 'Client: Acme Pictures', 'Vendor: Northlight', 'Vendor: Ember FX']);
  });

  it('is plain text for someone who may not change members', async () => {
    mockFetch(server);
    mount(<MembersPanel projectId={PID} />, artist);
    const table = await screen.findByRole('table', { name: 'Project members' });
    expect(await within(table).findByText('Client: Acme Pictures')).toBeTruthy();
    expect(within(table).getByText('Vendor: Ember FX')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /^Works for/ })).toBeNull();
  });

  it('changes one member to a vendor, and back to the studio, clearing the other field', async () => {
    const { calls } = mockFetch(server);
    mount(<MembersPanel projectId={PID} />);
    const select = await worksFor('Sam Studio');
    await waitFor(() => expect(optionLabels(select)).toContain('Vendor: Northlight'));

    fireEvent.change(select, { target: { value: `vendor:${ids.north}` } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH') as MockCall;
    expect(path(patch)).toBe(`/api/organizations/projects/${PID}/members/${studioMember.id}/`);
    expect(patch.body).toEqual({ client_id: '', vendor_id: ids.north });

    fireEvent.change(await worksFor('Vic Vendor'), { target: { value: '' } });
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'PATCH')[1].body).toEqual({ client_id: '', vendor_id: '' });
  });

  it('shows the server’s refusal', async () => {
    custom = (c) => (c.method === 'PATCH' ? reply(flow.member_vendor_refused) : undefined);
    mockFetch(server);
    mount(<MembersPanel projectId={PID} />);
    const select = await worksFor('Sam Studio');
    await waitFor(() => expect(optionLabels(select)).toContain('Vendor: Northlight'));
    fireEvent.change(select, { target: { value: `vendor:${ids.north}` } });
    await waitFor(() =>
      expect(useNotificationStore.getState().notifications.some((n) => String(n.message).includes('This vendor is not on the project.'))).toBe(true),
    );
  });

  it('adds a member who works for a vendor or the client, and sends neither for the studio', async () => {
    const { calls } = mockFetch(server);
    mount(<MembersPanel projectId={PID} />);
    const add = async (worksFor: string) => {
      await pickEntity('Add a member', 'Priya Person');
      const select = (await screen.findByLabelText('Works for')) as HTMLSelectElement;
      await waitFor(() => expect(optionLabels(select)).toEqual(['Studio', 'Client: Acme Pictures', 'Vendor: Northlight', 'Vendor: Ember FX']));
      fireEvent.change(select, { target: { value: worksFor } });
      fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    };
    const posts = () => calls.filter((c) => c.method === 'POST');

    await add(`vendor:${ids.ember}`);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({ user_id: newcomer.user, vendor_id: ids.ember });
    expect(posts()[0].body).not.toHaveProperty('client_id');

    await add(`client:${ids.acme}`);
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1].body).toMatchObject({ client_id: ids.acme });
    expect(posts()[1].body).not.toHaveProperty('vendor_id');

    await add('');
    await waitFor(() => expect(posts()).toHaveLength(3));
    expect(posts()[2].body).not.toHaveProperty('client_id');
    expect(posts()[2].body).not.toHaveProperty('vendor_id');
  });

  it('offers no Works for on the add form of a project with no client or vendors', async () => {
    custom = (c) => (path(c) === `/api/v1/projects/${PID}/` ? reply(flow.project_bare) : undefined);
    mockFetch(server);
    mount(<MembersPanel projectId={PID} />);
    await screen.findByRole('table', { name: 'Project members' });
    expect(screen.queryByLabelText('Works for')).toBeNull();
  });
});
