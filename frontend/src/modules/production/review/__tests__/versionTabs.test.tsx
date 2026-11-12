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
import { VersionCompareTab, VersionPlaylistsTab, VersionPublishingTab } from '../VersionExtras';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const pub = loadSample<Record<string, Captured>>('publishing/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;

const version = { ...flow.versions_detail.body, video_url: 'https://cdn.example.com/p/v1.mp4' };
const path = (c: MockCall) => new URL(c.url).pathname;
const param = (c: MockCall, name: string) => new URL(c.url).searchParams.get(name);
const bare = (list: unknown[]): MockReply => ({ status: 200, body: list });
const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function mount(ui: React.ReactElement) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
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

describe('version playlists tab', () => {
  // Captured with ?version_id= (C-RP-04): "Seeded" holds it once; "Dailies (renamed)" holds it twice, after another version.
  const holding = flow.rp1_playlists_by_version.body;
  const none = flow.rp1_playlists_by_version_none.body;
  const serve = (c: MockCall): MockReply => (param(c, 'version_id') === version.id ? { status: 200, body: holding } : { status: 200, body: none });

  it('lists the playlists the server says hold the version, with its place in each, asking by version_id', async () => {
    const { calls } = mockFetch(serve);
    mount(<VersionPlaylistsTab version={version} />);
    const list = within(await screen.findByRole('list', { name: 'Playlists holding this version' }));
    expect(list.getAllByRole('listitem')).toHaveLength(holding.results.length);
    for (const p of holding.results) expect(list.getByRole('link', { name: p.name }).getAttribute('href')).toBe(`/playlists/${p.id}`);
    expect(list.getByText('Entry 1 of 1')).toBeTruthy();
    expect(list.getByText('Entry 2 of 3 · in 2 entries')).toBeTruthy();
    expect(param(calls[0], 'version_id')).toBe(version.id);
    expect(param(calls[0], 'project_id')).toBeNull(); // no longer the whole project filtered on the client
  });

  it('says when it is in no playlist', async () => {
    mockFetch(() => ({ status: 200, body: none }));
    mount(<VersionPlaylistsTab version={version} />);
    expect(await screen.findByText(/not in any playlist/)).toBeTruthy();
  });
});

describe('version publishing tab', () => {
  const jobs = pub.jobs_list.body.results;
  const serve = (c: MockCall): MockReply => (path(c).endsWith('/publishing/') ? page(jobs) : page([]));

  it('says it is published and since when, lists its export jobs with the version filter, and shows the registered files', async () => {
    const { calls } = mockFetch(serve);
    mount(<VersionPublishingTab version={{ ...version, is_published: true, published_at: '2026-11-05T10:00:00Z', status: 'Approved' }} />);
    expect(await screen.findByText('Published')).toBeTruthy();
    expect(screen.getByText(/Unpublish it before archiving it/)).toBeTruthy();
    const list = within(await screen.findByRole('list', { name: 'Export jobs of this version' }));
    expect(list.getByRole('link', { name: new RegExp(jobs[0].code) }).getAttribute('href')).toBe(`/publishing/${jobs[0].id}`);
    expect(calls.some((c) => path(c).endsWith('/publishing/') && param(c, 'version_id') === version.id)).toBe(true);
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/publishing/files/') && param(c, 'version_id') === version.id)).toBe(true));
    expect(screen.getByRole('region', { name: 'Registered files' })).toBeTruthy();
  });

  it('tells an approved version it is ready, and any other that only an approved version can be published', async () => {
    mockFetch((c) => (path(c).endsWith('/publishing/') ? page([]) : page([])));
    mount(<VersionPublishingTab version={{ ...version, is_published: false, status: 'Approved' }} />);
    expect(await screen.findByText(/Approved and ready to publish/)).toBeTruthy();
    expect(await screen.findByText('No export job is tied to this version.')).toBeTruthy();
    cleanup();
    mockFetch(() => page([]));
    mount(<VersionPublishingTab version={{ ...version, is_published: false, status: 'In Progress' }} />);
    expect(await screen.findByText(/Only an approved version can be published/)).toBeTruthy();
    expect(screen.getByText('Not published')).toBeTruthy();
  });
});

describe('version compare tab', () => {
  const mk = (id: string, code: string, created: string, over: Record<string, unknown> = {}) => ({ ...version, id, code, created_at: created, video_url: `https://cdn.example.com/p/${code}.mp4`, ...over });
  const mine = mk(version.id, version.code, '2026-10-05T10:00:00Z');
  const older = mk('older', 'SH_V001', '2026-10-01T10:00:00Z', { status: 'Retake' });
  const newer = mk('newer', 'SH_V003', '2026-10-09T10:00:00Z', { status: 'Pending Review' });
  const otherShot = mk('other', 'OTHER_V001', '2026-10-08T10:00:00Z', { entity_id: 'a-different-shot' });

  it('puts this version (A) against the newest other of the same shot or asset (B), and either side can be switched', async () => {
    const { calls } = mockFetch(() => bare([mine, older, newer, otherShot]));
    mount(<VersionCompareTab version={mine} />);
    const a = (await screen.findByLabelText('Version A')) as HTMLSelectElement;
    const b = screen.getByLabelText('Version B') as HTMLSelectElement;
    expect(Array.from(b.options).map((o) => o.value)).toEqual([mine.id, 'newer', 'older']); // this one first, the newest next; not another shot's
    expect(a.value).toBe(mine.id);
    expect(b.value).toBe('newer');
    expect(screen.getByRole('group', { name: `${mine.code} against SH_V003` })).toBeTruthy();
    expect(screen.getByLabelText(`${mine.code} video`)).toBeTruthy();
    expect(screen.getByLabelText('SH_V003 video')).toBeTruthy();
    expect(param(calls[0], 'project_id')).toBe(version.project_id);
    fireEvent.change(b, { target: { value: 'older' } });
    await waitFor(() => expect(screen.getByRole('group', { name: `${mine.code} against SH_V001` })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Version A'), { target: { value: 'newer' } });
    await waitFor(() => expect(screen.getByRole('group', { name: 'SH_V003 against SH_V001' })).toBeTruthy());
  });

  it('says so when there is nothing else to compare with', async () => {
    mockFetch(() => bare([mine, otherShot]));
    mount(<VersionCompareTab version={mine} />);
    expect(await screen.findByText(/no other version of/)).toBeTruthy();
  });

  it('names the version with no preview', async () => {
    mockFetch(() => bare([mine, { ...newer, video_url: '' }]));
    mount(<VersionCompareTab version={mine} />);
    expect(await screen.findByText(/SH_V003 has none linked/)).toBeTruthy();
  });
});
