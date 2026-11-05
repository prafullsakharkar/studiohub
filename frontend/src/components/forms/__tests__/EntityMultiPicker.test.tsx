import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vendorsApi } from '@/api/masterdata/directory';
import type { Vendor } from '@/api/masterdata/directory';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { openPicker } from '@/test/picker';
import { loadSample } from '@/test/samples';
import { EntityMultiPicker } from '../EntityMultiPicker';

type Captured = { status: number; body: any };
const vendors = loadSample<Record<string, Captured>>('masterdata/vendors.json');
const cr42 = loadSample<Record<string, Captured>>('production/_vendor_ids_cr42_flow.json');
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;

const listed = vendors.list_admin.body.results as Vendor[];
/** A vendor that is not on the list page (fetched on its own), and one deleted since (the API says 404). */
const north = cr42.vendor_rename_north.body as Vendor;
const deletedId = cr42.vendor_create_ember.body.id as string;

const server = (c: MockCall): MockReply => {
  if (path(c) === '/api/v1/vendors/') return reply(vendors.list_admin);
  if (path(c) === `/api/v1/vendors/${north.id}/`) return reply(cr42.vendor_rename_north);
  if (path(c) === `/api/v1/vendors/${deletedId}/`) return reply(vendors.detail_404);
  return { status: 404, body: {} };
};

/** Keeps the value, like a form does. */
function Controlled({ initial = [], onChange = () => undefined }: { initial?: string[]; onChange?: (ids: string[]) => void }) {
  const [value, setValue] = useState<string[]>(initial);
  const client = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }))[0];
  return (
    <QueryClientProvider client={client}>
      <EntityMultiPicker<Vendor>
        label="Vendors"
        queryKey={['t-vendors']}
        fetchPage={vendorsApi.list}
        fetchOne={vendorsApi.get}
        getLabel={(v) => v.name}
        unknownLabel="Unknown vendor"
        value={value}
        onChange={(ids) => {
          setValue(ids);
          onChange(ids);
        }}
      />
    </QueryClientProvider>
  );
}

const chips = () => within(screen.getByRole('list', { name: 'Chosen vendors' })).queryAllByRole('listitem').map((li) => li.textContent);
const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('EntityMultiPicker', () => {
  it('checks and unchecks options, keeping the menu open, and shows the chosen as chips in order', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const { menu } = await openPicker('Vendors');
    expect(menu.getAttribute('aria-multiselectable')).toBe('true');

    fireEvent.click(await within(menu).findByRole('option', { name: listed[1].name }));
    fireEvent.click(within(menu).getByRole('option', { name: listed[0].name }));
    expect(onChange).toHaveBeenLastCalledWith([listed[1].id, listed[0].id]);
    expect(screen.getByRole('listbox')).toBe(menu); // still open
    expect(within(menu).getByRole('option', { name: listed[0].name }).getAttribute('aria-selected')).toBe('true');
    expect(chips()).toEqual([listed[1].name, listed[0].name]);

    fireEvent.click(within(menu).getByRole('option', { name: listed[1].name }));
    expect(onChange).toHaveBeenLastCalledWith([listed[0].id]);
    expect(within(menu).getByRole('option', { name: listed[1].name }).getAttribute('aria-selected')).toBe('false');
    expect(within(menu.parentElement as HTMLElement).getByText('1 chosen')).toBeTruthy();
  });

  it('Enter toggles the active option from the search box; Backspace in an empty search removes the last chip; Escape closes', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const { trigger, menu } = await openPicker('Vendors');
    await within(menu).findByRole('option', { name: listed[0].name });
    const search = screen.getByLabelText('Search vendors');

    key(search, 'Enter');
    key(search, 'ArrowDown');
    key(search, 'Enter');
    expect(onChange).toHaveBeenLastCalledWith([listed[0].id, listed[1].id]);

    key(search, 'Backspace');
    expect(onChange).toHaveBeenLastCalledWith([listed[0].id]);

    key(search, 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('a saved id that is not on the loaded page is fetched for its label; one deleted since is "Unknown vendor", and can be removed', async () => {
    const { calls } = mockFetch(server);
    const onChange = vi.fn();
    render(<Controlled initial={[north.id, deletedId, listed[0].id]} onChange={onChange} />);

    await waitFor(() => expect(chips()).toEqual([north.name, 'Unknown vendor', listed[0].name]));
    expect(calls.some((c) => path(c) === `/api/v1/vendors/${north.id}/`)).toBe(true);
    expect(calls.some((c) => path(c) === `/api/v1/vendors/${listed[0].id}/`)).toBe(false); // on the page: no extra request

    const flagged = within(screen.getByRole('list', { name: 'Chosen vendors' })).getAllByRole('listitem').filter((li) => li.hasAttribute('data-unknown'));
    expect(flagged.map((li) => li.textContent)).toEqual(['Unknown vendor']); // only the deleted one is marked
    fireEvent.click(screen.getByRole('button', { name: 'Remove Unknown vendor' }));
    expect(onChange).toHaveBeenLastCalledWith([north.id, listed[0].id]);
  });

  it('Clear all empties the list', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Controlled initial={[listed[0].id, listed[1].id]} onChange={onChange} />);
    const { menu } = await openPicker('Vendors');
    fireEvent.click(within(menu.parentElement as HTMLElement).getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(chips()).toEqual([]);
  });
});
