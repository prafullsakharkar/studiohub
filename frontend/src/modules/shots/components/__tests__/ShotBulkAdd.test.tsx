import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';

const mocked = vi.hoisted(() => ({ props: null as any }));
vi.mock('../bulk/ShotBulkManager', () => ({
  ShotBulkManager: (props: any) => {
    mocked.props = props;
    return null;
  },
}));

import { ShotBulkAdd } from '../ShotBulkAdd';

type Captured = { status: number; body: any };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const episodic = structure.projects_detail.body as { id: string; code: string };
const standard = work.setup_project.body as { id: string; code: string; workflow_type: string };
const episodes = structure.episodes_list.body.results as Array<{ id: string; code: string; name: string }>;
const sequences = structure.sequences_list.body.results as Array<{ id: string; code: string; episode_id: string | null }>;
const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]) => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function renderIt(projectId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <ShotBulkAdd projectId={projectId} />
    </QueryClientProvider>
  );
}
async function open() {
  const button = await screen.findByRole('button', { name: 'Bulk add shots' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
}

beforeEach(() => {
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  mocked.props = null;
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('bulk add shots: production wiring of the grid manager', () => {
  it('on an episodic project it passes the real episodes and sequences and callbacks that create them', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST' && path(c) === '/api/v1/episodes/') return { status: 201, body: { ...episodes[0], id: 'ep-new', code: 'EP102', name: 'Second' } };
      if (c.method === 'POST' && path(c) === '/api/v1/sequences/') return { status: 201, body: { ...sequences[0], id: 'seq-new', code: 'SQ020' } };
      if (path(c) === '/api/v1/episodes/') return page(episodes);
      if (path(c) === '/api/v1/sequences/') return page(sequences);
      return { status: 200, body: episodic };
    });
    renderIt(episodic.id);
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/sequences/')).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    await open();
    const props = mocked.props;

    expect(props.projectId).toBe(episodic.id);
    expect(props.isEpisodic).toBe(true);
    expect(props.episodes).toEqual(episodes.map((e) => ({ id: e.id, code: e.code, name: e.name })));
    expect(props.sequences).toEqual(sequences.map((s) => ({ id: s.id, code: s.code, episode_id: s.episode_id ?? undefined })));

    const createdEpisode = await props.onCreateEpisode({ project_id: episodic.id, code: 'EP102', name: 'Second' });
    const episodePost = calls.find((c) => c.method === 'POST' && path(c) === '/api/v1/episodes/')!;
    expect(episodePost.body).toMatchObject({ project: episodic.id, code: 'EP102', name: 'Second', season_number: 1, episode_number: episodes.length + 1 });
    expect(createdEpisode).toMatchObject({ id: 'ep-new', code: 'EP102' });

    const createdSequence = await props.onCreateSequence({ project_id: episodic.id, episode_id: episodes[0].id, code: 'sq020' });
    const sequencePost = calls.find((c) => c.method === 'POST' && path(c) === '/api/v1/sequences/')!;
    expect(sequencePost.body).toEqual({ project: episodic.id, episode_id: episodes[0].id, code: 'SQ020' }); // codes are upper case
    expect(createdSequence).toMatchObject({ id: 'seq-new' });
  });

  it('on a standard project it passes none of the episodic props and never lists episodes', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: standard }));
    renderIt(standard.id);
    await open();
    const props = mocked.props;
    expect(props.projectId).toBe(standard.id);
    for (const key of ['isEpisodic', 'episodes', 'sequences', 'onCreateEpisode', 'onCreateSequence']) expect(props[key], key).toBeUndefined();
    expect(calls.some((c) => path(c) === '/api/v1/episodes/')).toBe(false);
  });

  it('withholds the sequence list until it has loaded, so the manager never prompts blind', async () => {
    mockFetch((c) => {
      if (path(c) === '/api/v1/episodes/') return page(episodes);
      if (path(c) === '/api/v1/sequences/') return { ...page(sequences), delayMs: 400 };
      return { status: 200, body: episodic };
    });
    renderIt(episodic.id);
    await open();
    expect(mocked.props.isEpisodic).toBe(true);
    expect(mocked.props.sequences).toBeUndefined();
  });
});
