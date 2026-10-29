import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeLog } from '@/api/audit/audit';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { EntityHistory } from '../EntityHistory';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('audit/_audit_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const logs = flow.changelogs_for_dept.body.results as ChangeLog[]; // update (color), update (name, description), create
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });

const server = (c: MockCall): MockReply => (path(c).endsWith('/change-logs/') ? reply(flow.changelogs_for_dept) : reply(flow.audit_compat_search_dept));

function renderHistory(user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <EntityHistory targetType="Department" targetId={logs[0].target_id} />
        </MemoryRouter>
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

describe('EntityHistory', () => {
  it('asks for this record’s change logs by target_type and target_id, newest first', async () => {
    const { calls } = mockFetch(server);
    renderHistory(superuser);
    expect(await screen.findByText('changed color')).toBeTruthy();
    const call = calls.find((c) => path(c).endsWith('/change-logs/'))!;
    expect(q(call)).toMatchObject({ target_type: 'Department', target_id: logs[0].target_id });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('update')).toBeTruthy();
    expect(within(items[2]).getByText('create')).toBeTruthy();
  });

  it('expands an entry to the before/after of exactly the fields that changed, with the actor', async () => {
    mockFetch(server);
    renderHistory(superuser);
    fireEvent.click(await screen.findByRole('button', { name: /changed color/ }));
    const table = await screen.findByRole('table', { name: /Changes in/ });
    const row = within(table).getByText('color').closest('tr') as HTMLElement;
    expect(within(row).getByText('—')).toBeTruthy(); // before: empty
    expect(within(row).getByText('#ff8800')).toBeTruthy(); // after
    expect(within(table).queryByText('name')).toBeNull(); // unchanged fields are not listed
    expect(screen.getAllByText(logs[0].user_name).length).toBeGreaterThan(0);
  });

  it('a create entry lists the values the record started with', async () => {
    mockFetch(server);
    renderHistory(superuser);
    const buttons = await screen.findAllByRole('button', { name: /create/ });
    fireEvent.click(buttons[0]);
    const table = await screen.findByRole('table', { name: /Changes in/ });
    expect(within(table).getByText('Look Dev Unit')).toBeTruthy();
    expect(within(table).getByText('department_type')).toBeTruthy();
  });

  it('requests nothing and explains why for a user without audit.view', async () => {
    const { calls } = mockFetch(server);
    renderHistory(artist);
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows the audit events about the record only when there are some, matched on entity_id', async () => {
    const event = { id: 'e1', uuid: 'e1', action: 'approve', user_name: 'Pat', user_email: 'p@x.test', description: 'Signed off', entity_id: logs[0].target_id, entity_type: 'Department' };
    const other = { ...event, id: 'e2', description: 'Someone else’s event', entity_id: 'another-record' };
    mockFetch((c) => (path(c).endsWith('/change-logs/') ? reply(flow.changelogs_for_dept) : { body: { count: 2, next: null, previous: null, results: [event, other] } }));
    renderHistory(superuser);
    expect(await screen.findByText(/Signed off/)).toBeTruthy();
    expect(screen.queryByText(/Someone else/)).toBeNull();
  });
});
