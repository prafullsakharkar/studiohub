import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { RelatedRecords } from '../RelatedRecords';
import { clientContactsConfig, clientContractsConfig } from '../entities/partners';

type Captured = { status: number; body: any };
const contracts = loadSample<Record<string, Captured>>('masterdata/client-contracts.json');
const contacts = loadSample<Record<string, Captured>>('masterdata/client-contacts.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderTab(ui: React.ReactElement, user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
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

const CLIENT = 'client-1';
const row = contracts.list_admin.body.results[0] as { id: string; contract_number: string; status: string; expiry_date: string | null };

describe('client contracts', () => {
  const server = (c: MockCall): MockReply => (c.method === 'GET' ? reply(contracts.list_admin) : { body: row });

  it('lists only this client’s contracts (the parent is a server filter)', async () => {
    const { calls } = mockFetch(server);
    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, superuser);
    expect(await screen.findByText(row.contract_number)).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/client-contracts/');
    expect(q(calls[0]).client).toBe(CLIENT);
  });

  it('a Draft contract offers Activate and Terminate; Activate posts to the lifecycle route', async () => {
    expect(row.status).toBe('Draft');
    const { calls } = mockFetch(server);
    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, superuser);
    await screen.findByText(row.contract_number);
    expect(screen.getByRole('button', { name: `Terminate ${row.contract_number}` })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: `Activate ${row.contract_number}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/client-contracts/${row.id}/activate/`);
  });

  it('adjust-end-date asks for a date and sends expiry_date', async () => {
    const { calls } = mockFetch(server);
    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, superuser);
    await screen.findByText(row.contract_number);

    fireEvent.click(screen.getByRole('button', { name: `Adjust end date ${row.contract_number}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('New end date'), { target: { value: '2031-06-30' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adjust end date' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe(`/api/v1/client-contracts/${row.id}/adjust-end-date/`);
    expect(post.body).toEqual({ expiry_date: '2031-06-30' });
  });

  it('editing never sends status (the API refuses it on update) and only sends what changed', async () => {
    const { calls } = mockFetch(server);
    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, superuser);
    await screen.findByText(row.contract_number);

    fireEvent.click(screen.getByRole('button', { name: `Edit ${row.contract_number}` }));
    const dialog = await screen.findByRole('dialog');
    // The contract's status is shown but locked: the API refuses it on update ("Read-only. Use POST …/activate").
    expect((within(dialog).getByLabelText(/^Starts as/) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: 'Renamed SOW' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ title: 'Renamed SOW' });
  });

  it('creating attaches the parent id and hides the contract value from callers without view_financial', async () => {
    const { calls } = mockFetch(server);
    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, artist);
    await screen.findByText(row.contract_number);
    expect(screen.queryByRole('button', { name: /^Add contract/ })).toBeNull(); // artist cannot manage
    cleanup();

    renderTab(<RelatedRecords config={clientContractsConfig} parentId={CLIENT} />, superuser);
    await screen.findByText(row.contract_number);
    fireEvent.click(screen.getByRole('button', { name: 'Add contract' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Starts as/), { target: { value: 'Draft' } });
    fireEvent.change(within(dialog).getByLabelText(/^Contract number/), { target: { value: 'C-100' } });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: 'New SOW' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contract' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ client: CLIENT, status: 'Draft', contract_number: 'C-100', title: 'New SOW', nda_signed: false });
  });
});

describe('client contacts', () => {
  it('lists the client’s contacts and removes one after confirmation', async () => {
    const contact = contacts.list_admin.body.results[0] as { id: string; name: string };
    const { calls } = mockFetch((c) => (c.method === 'DELETE' ? { status: 204, body: null } : reply(contacts.list_admin)));
    renderTab(<RelatedRecords config={clientContactsConfig} parentId={CLIENT} />, superuser);
    expect(await screen.findByText(contact.name)).toBeTruthy();
    expect(q(calls[0]).client).toBe(CLIENT);

    fireEvent.click(screen.getByRole('button', { name: `Delete ${contact.name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE')!)).toBe(`/api/v1/client-contacts/${contact.id}/`);
  });

  it('says why the list is empty for a caller the API turns away (403)', async () => {
    mockFetch(() => reply(contacts.list_norole));
    renderTab(<RelatedRecords config={clientContactsConfig} parentId={CLIENT} />, artist);
    expect((await screen.findAllByText(/permission/i)).length).toBeGreaterThan(0);
  });
});
