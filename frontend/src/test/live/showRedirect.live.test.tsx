import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectsApi, showsApi } from '@/api/production/structure';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { authService } from '@/modules/auth/services/AuthService';
import { ShowRedirectPage } from '@/modules/production/pages/ShowRedirectPage';
import { freshTotp, live } from './liveBackend';

/** `/shows/:showId` against a REAL backend. Run on a fresh live_backend.py seed. */
const T = { timeout: 15000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const Where: React.FC = () => <p>{`at ${useLocation().pathname}`}</p>;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
}, 60000);

const mount = (showId: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/shows/${showId}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/shows/:showId" element={<ShowRedirectPage />} />
            <Route path="/projects/:id" element={<Where />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('show address on the wire', () => {
  it('opens the project of a real show', async () => {
    const project = await projectsApi.create({ code: `SR${uid}`, name: 'Show redirect', workflow_type: 'standard' });
    const show = await showsApi.create({ project: project.id, code: `S${uid}`, name: 'Season One' });
    expect((await showsApi.get(show.id)).project_id).toBe(project.id);

    mount(show.id);
    expect(await screen.findByText(`at /projects/${project.id}`, {}, T)).toBeTruthy();
  });

  it('says so for a show that does not exist', async () => {
    mount('00000000-0000-4000-8000-000000000000');
    expect(await screen.findByText('Show not found', {}, T)).toBeTruthy();
  });
});
