import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { ShowRedirectPage } from '../pages/ShowRedirectPage';

type Captured = { status: number; body: unknown };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const show = structure.shows_create.body as { id: string; project_id: string };

const Where: React.FC = () => <p>{`at ${useLocation().pathname}`}</p>;
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={[`/shows/${show.id}`]}>
        <Routes>
          <Route path="/shows/:showId" element={<ShowRedirectPage />} />
          <Route path="/projects/:id" element={<Where />} />
          <Route path="/projects" element={<p>Projects</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('/shows/:showId', () => {
  it('opens the project the show belongs to, not a project named by the show’s id', async () => {
    const { calls } = mockFetch(() => ({ body: structure.shows_create.body }));
    mount();
    expect(await screen.findByText(`at /projects/${show.project_id}`)).toBeTruthy();
    expect(new URL(calls[0].url).pathname).toBe(`/api/v1/shows/${show.id}/`);
  });

  it('says so when the show cannot be opened, and offers the project list', async () => {
    mockFetch(() => ({ status: 404, body: { detail: 'Not found.', error: { code: 'not_found', request_id: 'r' } } }));
    mount();
    expect(await screen.findByText('Show not found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to projects' }).getAttribute('href')).toBe('/projects');
  });
});
