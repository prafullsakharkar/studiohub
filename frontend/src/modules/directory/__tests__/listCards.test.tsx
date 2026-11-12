import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useDeliveriesListConfig } from '@/modules/deliveries/deliveries';
import { useMediaListConfig } from '@/modules/production/review/media';
import { mediaName } from '@/modules/production/review/mediaCard';
import { useReviewsListConfig } from '@/modules/production/review/reviews';
import { useVersionsListConfig } from '@/modules/production/review/versions';
import { usePublishListConfig } from '@/modules/publishing/jobs';
import { mockFetch } from '@/test/fetchMock';
import type { MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { DirectoryListPage } from '../DirectoryListPage';
import type { DirectoryListConfig } from '../types';

type Captured = { status: number; body: any };
const review = loadSample<Record<string, Captured>>('production/_review_flow.json');
const delivery = loadSample<Record<string, Captured>>('deliveries/_flow.json');
const publishing = loadSample<Record<string, Captured>>('publishing/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function Screen({ useConfig }: { useConfig: () => DirectoryListConfig<any> }) {
  return <DirectoryListPage config={useConfig()} />;
}

/** The list at its own path, switched to Card view; resolves with the cards. */
async function openCards(useConfig: () => DirectoryListConfig<any>, path: string, title: string, reply: MockReply, user: User = superuser) {
  mockFetch(() => reply);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={<Screen useConfig={useConfig} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  await screen.findByRole('table', { name: title });
  fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
  return within(await screen.findByRole('list', { name: title })).getAllByRole('listitem');
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

describe('version cards', () => {
  const rows = review.versions_list.body.results as any[];

  it('show the version number and status over the picture, the code, the shot and who made it; the title opens the version', async () => {
    const cards = await openCards(useVersionsListConfig, '/versions', 'Versions', page(rows));
    expect(cards).toHaveLength(rows.length);
    const card = cards[0];
    expect(within(card).getByText(rows[0].version_number)).toBeTruthy();
    expect(within(card).getByText(rows[0].status)).toBeTruthy();
    expect(within(card).getByText(rows[0].entity_code)).toBeTruthy();
    expect(within(card).getByRole('link', { name: rows[0].code }).getAttribute('href')).toBe(`/versions/${rows[0].id}`);
    expect(within(card).getByText(rows[0].artist_name || 'No artist')).toBeTruthy();
  });

  it('draw the thumbnail when the address is a web address, and a placeholder for anything else', async () => {
    const withPicture = { ...rows[0], thumbnail_url: 'https://cdn.example.com/t.jpg' };
    const unsafe = { ...rows[1], thumbnail_url: 'javascript:alert(1)' };
    const cards = await openCards(useVersionsListConfig, '/versions', 'Versions', page([withPicture, unsafe]));
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.com/t.jpg');
    expect(cards[1].querySelector('img')).toBeNull();
    // the picture sits in a decorative link (the title is the real one), so it is hidden from the accessibility tree
    expect(within(cards[1]).getByRole('img', { name: `${unsafe.code} thumbnail`, hidden: true })).toBeTruthy();
  });

  it('mark the hero and the published version', async () => {
    const cards = await openCards(useVersionsListConfig, '/versions', 'Versions', page([{ ...rows[0], is_hero: true, is_published: true }]));
    expect(within(cards[0]).getByText('Hero')).toBeTruthy();
    expect(within(cards[0]).getByText('Published')).toBeTruthy();
  });
});

describe('review cards', () => {
  const rows = review.reviews_list.body.results as any[];

  it('show the code and status over the picture, the title as the link, and the version and comment counts', async () => {
    const cards = await openCards(useReviewsListConfig, '/reviews', 'Reviews', page(rows));
    const card = cards[0];
    expect(within(card).getByText(rows[0].code)).toBeTruthy();
    expect(within(card).getByText(rows[0].status)).toBeTruthy();
    expect(within(card).getByRole('link', { name: rows[0].title }).getAttribute('href')).toBe(`/reviews/${rows[0].id}`);
    expect(within(card).getByTitle('Versions').textContent).toContain(String(rows[0].versions.length));
    expect(within(card).getByTitle('Comments').textContent).toContain(String(rows[0].comments.length));
  });
});

describe('media cards', () => {
  const rows = review.media_list.body.items as any[];

  it('show the type and format over the thumbnail and the file facts; a media item has no detail page, so the title is not a link', async () => {
    const cards = await openCards(useMediaListConfig, '/media', 'Media', page(rows));
    expect(cards).toHaveLength(rows.length);
    const card = cards[0];
    expect(within(card).getByText(rows[0].media_type)).toBeTruthy();
    expect(within(card).getByText('Storage')).toBeTruthy();
    expect(within(card).queryByRole('link', { name: new RegExp(`^${mediaName(rows[0])}$`) })).toBeNull();
    expect(within(card).getByRole('link', { name: `Edit ${mediaName(rows[0])}` })).toBeTruthy();
  });
});

describe('delivery cards', () => {
  const rows = delivery.list_admin.body.results as any[];

  it('show the code and status on a band (a delivery has no picture), the version count, the client and the method', async () => {
    const cards = await openCards(useDeliveriesListConfig, '/deliveries', 'Deliveries', page(rows));
    const card = cards[0];
    expect(within(card).getByText(rows[0].code)).toBeTruthy();
    expect(within(card).getByText(rows[0].status)).toBeTruthy();
    expect(within(card).getByText(new RegExp(`^${rows[0].version_count} versions?$`))).toBeTruthy();
    expect(within(card).getByText(rows[0].delivery_method)).toBeTruthy();
    expect(within(card).getByRole('link', { name: rows[0].name }).getAttribute('href')).toBe(`/deliveries/${rows[0].id}`);
    expect(card.querySelector('img')).toBeNull();
  });

  it('flag an expired due date, and only show the client answer once there is one', async () => {
    const cards = await openCards(useDeliveriesListConfig, '/deliveries', 'Deliveries', page([
      { ...rows[0], expires_at: '2020-01-02T00:00:00Z', is_expired: true, client_status: 'Pending' },
      { ...rows[1], client_status: 'Rejected' },
    ]));
    expect(within(cards[0]).queryByText('Client answer')).toBeNull();
    expect(within(cards[0]).getByText('Due').nextElementSibling?.querySelector('span')?.className).toContain('text-rose-400');
    expect(within(cards[1]).getByText('Due').nextElementSibling?.querySelector('span')?.className).not.toContain('text-rose-400');
    expect(within(cards[1]).getByText('Client answer')).toBeTruthy();
  });

  it('keep the table rules: a sent delivery offers no Edit and no Delete on its card', async () => {
    const sent = { ...rows[0], status: 'Submitted' };
    const cards = await openCards(useDeliveriesListConfig, '/deliveries', 'Deliveries', page([sent]));
    expect(within(cards[0]).queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(within(cards[0]).queryByRole('button', { name: /^Delete / })).toBeNull();
  });
});

describe('publish cards', () => {
  const rows = publishing.jobs_list_admin.body.results as any[];

  it('show the tool and the status over the band, the shot or asset, the job name and its project', async () => {
    const cards = await openCards(usePublishListConfig, '/publishing', 'Publishing', page(rows));
    const card = cards[0];
    expect(within(card).getByText(new RegExp(`^${rows[0].dcc_tool_display}`))).toBeTruthy();
    expect(within(card).getByText(rows[0].entity_code)).toBeTruthy();
    expect(within(card).getByRole('link', { name: rows[0].name })).toBeTruthy();
    expect(within(card).getByText(rows[0].client_name)).toBeTruthy();
  });

  it('say so on a failed job, and only then', async () => {
    const cards = await openCards(usePublishListConfig, '/publishing', 'Publishing', page([{ ...rows[0], is_failed: true, job_status: 'Failed' }, { ...rows[1], is_failed: false }]));
    expect(within(cards[0]).getByText(/The export failed/)).toBeTruthy();
    expect(within(cards[1]).queryByText(/The export failed/)).toBeNull();
  });
});

describe('cards for a viewer', () => {
  it('show the same card without any control', async () => {
    const rows = review.versions_list.body.results as any[];
    const cards = await openCards(useVersionsListConfig, '/versions', 'Versions', page(rows), artist);
    expect(cards).toHaveLength(rows.length);
    expect(within(cards[0]).queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(within(cards[0]).queryByRole('button', { name: /^Archive / })).toBeNull();
  });
});
