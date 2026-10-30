import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { EntityMediaTab, EntityReviewsTab, EntityVersionsTab } from '../EntityRecords';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const noCreate = { ...artist, permissions: artist.permissions.filter((p) => !p.endsWith('.create')) } as User;

const versions = flow.versions_list.body.results as Array<{ id: string; code: string; entity_type: string; entity_id: string; project_id: string }>;
const shotVersion = versions[2]; // SH0010_V002; the list also holds another shot's and an asset's versions
const shot = { type: 'Shot', id: shotVersion.entity_id, projectId: shotVersion.project_id } as const;

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

function show(ui: React.ReactElement, user = artist) {
  const mocked = mockFetch((c) => {
    const p = new URL(c.url).pathname;
    if (p === '/api/v1/versions/') return { status: 200, body: flow.versions_list.body };
    if (p === '/api/v1/reviews/') return { status: 200, body: flow.reviews_list.body };
    return { status: 200, body: flow.media_list.body.items };
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return mocked;
}

describe('shot and asset tabs', () => {
  it('versions: only this entity’s are shown (the server ignores entity_id); the request narrows by project and type', async () => {
    const { calls } = show(<EntityVersionsTab entity={shot} />);
    await screen.findByRole('link', { name: new RegExp(`^${shotVersion.code}`) });
    expect(screen.queryByText(new RegExp(versions[0].code))).toBeNull(); // another shot
    expect(screen.queryByText(new RegExp(versions[1].code))).toBeNull(); // an asset
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const params = new URL(calls[0].url).searchParams;
    expect(params.get('project_id')).toBe(shot.projectId);
    expect(params.get('entity_type')).toBe('Shot');
    expect(params.has('entity_id')).toBe(false);
  });

  it('versions: New version opens the form pre-filled with the shot; an asset pre-fills the asset', async () => {
    show(<EntityVersionsTab entity={shot} />);
    expect((await screen.findByRole('link', { name: 'New version' })).getAttribute('href')).toBe(`/versions/new?project=${shot.projectId}&shot=${shot.id}`);
    cleanup();
    show(<EntityVersionsTab entity={{ type: 'Asset', id: versions[1].entity_id, projectId: versions[1].project_id }} />);
    expect((await screen.findByRole('link', { name: 'New version' })).getAttribute('href')).toBe(`/versions/new?project=${versions[1].project_id}&asset=${versions[1].entity_id}`);
  });

  it('without version.create there is no New version link; an entity with nothing says so', async () => {
    show(<EntityVersionsTab entity={{ type: 'Shot', id: 'no-such-shot', projectId: shot.projectId }} />, noCreate);
    await screen.findByText('No versions of this shot yet.');
    expect(screen.queryByRole('link', { name: 'New version' })).toBeNull();
  });

  it('reviews: only this entity’s, linked to their workspace; media: only this entity’s, from a bare-array list', async () => {
    show(<EntityReviewsTab entity={{ type: 'Shot', id: flow.reviews_list.body.results[1].entity_id, projectId: shot.projectId }} />);
    await screen.findByRole('link', { name: /^RV001/ });
    expect(screen.queryByText(/RV999/)).toBeNull();
    cleanup();

    const media = flow.media_list.body.items[0];
    show(<EntityMediaTab entity={{ type: 'Shot', id: media.entity_id, projectId: media.project_id }} />);
    expect(await screen.findAllByRole('link', { name: 'Open' })).toBeTruthy();
    cleanup();
    show(<EntityMediaTab entity={{ type: 'Asset', id: media.entity_id, projectId: media.project_id }} />); // same id, other type
    await screen.findByText('No media on this asset yet.');
  });
});
