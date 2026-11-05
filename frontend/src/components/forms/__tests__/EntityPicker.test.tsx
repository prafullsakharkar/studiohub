import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { Modal } from '@/shared/components/Modal';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { openPicker, pickEntity } from '@/test/picker';
import { loadSample } from '@/test/samples';
import { EntityPicker } from '../EntityPicker';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('masterdata/_departments_flow.json');
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });

const server = (c: MockCall): MockReply => {
  const params = q(c);
  if (new URL(c.url).pathname !== '/api/v1/departments/') return { status: 404, body: {} };
  if (params.search === 'comp') return reply(flow.list_search_comp);
  if (params.page === '2') return reply(flow.list_page_2_of_size_2);
  return reply(flow.list_page_size_2); // first page, with a `next` link
};

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Harness({ value = null, onChange = () => undefined, fetchOne }: { value?: string | null; onChange?: (id: string | null) => void; fetchOne?: (id: string) => Promise<Department> }) {
  return (
    <QueryClientProvider client={client()}>
      <EntityPicker<Department> label="Department" queryKey={['t-departments']} fetchPage={departmentsApi.list} fetchOne={fetchOne} getLabel={(d) => d.name} value={value} onChange={onChange} />
    </QueryClientProvider>
  );
}

/** Keeps the value, like a form does, so the field shows what was picked. */
function Controlled({ onChange }: { onChange: (id: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Harness
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('EntityPicker', () => {
  const firstPage = flow.list_page_size_2.body.results as Department[];
  const secondPage = flow.list_page_2_of_size_2.body.results as Department[];
  const searchResults = flow.list_search_comp.body.results as Department[];

  it('is a closed field until opened; the menu has the search box, focused', async () => {
    mockFetch(server);
    render(<Harness />);
    const trigger = screen.getByLabelText('Department', { selector: 'button' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    const { menu } = await openPicker('Department');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(await within(menu).findByRole('option', { name: firstPage[0].name })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Search department'));
  });

  it('reports the chosen id, shows its label in the field, and Clear reports null', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await pickEntity('Department', firstPage[0].name);
    expect(onChange).toHaveBeenLastCalledWith(firstPage[0].id);
    expect(screen.queryByRole('listbox')).toBeNull(); // picking closes the menu
    expect(screen.getByLabelText('Department', { selector: 'button' }).textContent).toContain(firstPage[0].name);

    await openPicker('Department');
    expect(screen.getByRole('option', { name: firstPage[0].name }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('searches on the server (debounced) instead of filtering the loaded page', async () => {
    const { calls } = mockFetch(server);
    render(<Harness />);
    const { menu } = await openPicker('Department', { search: 'comp' });

    await waitFor(() => expect(calls.some((c) => q(c).search === 'comp')).toBe(true));
    expect(await within(menu).findByRole('option', { name: searchResults[0].name })).toBeTruthy();
  });

  it('"Load more" follows the pagination and keeps the earlier rows', async () => {
    const { calls } = mockFetch(server);
    render(<Harness />);
    const { menu } = await openPicker('Department');
    await within(menu).findByRole('option', { name: firstPage[0].name });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await within(menu).findByRole('option', { name: secondPage[0].name })).toBeTruthy();
    expect(within(menu).getByRole('option', { name: firstPage[0].name })).toBeTruthy();
    expect(calls.some((c) => q(c).page === '2')).toBe(true);
  });

  it('shows the label of a saved value that is not on the loaded pages, via fetchOne', async () => {
    mockFetch(server);
    const saved = { ...firstPage[0], id: 'saved-elsewhere', name: 'Saved on page 9' };
    const fetchOne = vi.fn().mockResolvedValue(saved);
    render(<Harness value="saved-elsewhere" fetchOne={fetchOne} />);

    await waitFor(() => expect(screen.getByLabelText('Department', { selector: 'button' }).textContent).toContain('Saved on page 9'));
    expect(fetchOne).toHaveBeenCalledWith('saved-elsewhere', expect.anything());
    const { menu } = await openPicker('Department');
    const options = await within(menu).findAllByRole('option');
    expect(options[0].textContent).toBe('Saved on page 9'); // listed first, marked as chosen
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('works from the keyboard: arrows move the active option, Enter picks, Escape closes', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByLabelText('Department', { selector: 'button' });
    await waitFor(() => expect(screen.getByLabelText('Department', { selector: 'button' })).toBeTruthy());

    key(trigger, 'ArrowDown');
    const box = screen.getByLabelText('Search department');
    await screen.findByRole('option', { name: firstPage[1].name });
    expect(box.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: firstPage[0].name }).id);
    key(box, 'ArrowDown');
    expect(box.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: firstPage[1].name }).id);
    key(box, 'Enter');
    expect(onChange).toHaveBeenLastCalledWith(firstPage[1].id);
    expect(document.activeElement).toBe(trigger); // focus goes back to the field

    key(trigger, 'Enter');
    key(screen.getByLabelText('Search department'), 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape in the menu closes only the menu, not a dialog around it', async () => {
    mockFetch(server);
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={client()}>
        <Modal isOpen onClose={onClose} title="Edit team">
          <EntityPicker<Department> label="Department" queryKey={['t-departments']} fetchPage={departmentsApi.list} getLabel={(d) => d.name} value={null} onChange={() => undefined} />
        </Modal>
      </QueryClientProvider>
    );
    await openPicker('Department');
    key(screen.getByLabelText('Search department'), 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a click outside closes the menu', async () => {
    mockFetch(server);
    render(<Harness />);
    await openPicker('Department');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('says so when the list cannot be loaded and offers a retry', async () => {
    mockFetch(() => ({ status: 500, body: { detail: 'Internal server error.' } }));
    render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
