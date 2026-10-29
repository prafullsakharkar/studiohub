import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { ApiHealthPage } from '../pages/ApiHealthPage';
import { HEALTH_PROBES, classify, runProbe } from '../health/useApiHealth';

const version = loadSample('core/info__version.json').list_anon;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('classify', () => {
  it('maps what was measured to a state', () => {
    expect(classify(200, 40, 1000)).toBe('operational');
    expect(classify(200, 1500, 1000)).toBe('slow');
    expect(classify(401, 30, 1000)).toBe('restricted');
    expect(classify(403, 30, 1000)).toBe('restricted');
    expect(classify(500, 30, 1000)).toBe('down');
    expect(classify(404, 30, 1000)).toBe('down');
    expect(classify(null, null, 1000)).toBe('down');
  });
});

describe('runProbe', () => {
  const probe = HEALTH_PROBES[0];

  it('reports the real status and a measured latency (public version route, real sample)', async () => {
    mockFetch(() => ({ status: version.status, body: version.body, delayMs: 15 }));
    const result = await runProbe(probe);
    expect(result.state).toBe('operational');
    expect(result.status).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(10);
  });

  it('marks a slow answer as slow', async () => {
    mockFetch(() => ({ body: {}, delayMs: 40 }));
    expect((await runProbe(probe, 20)).state).toBe('slow');
  });

  it('a server error is down, never "operational"', async () => {
    mockFetch(() => ({ status: 500, body: {} }));
    expect((await runProbe(probe)).state).toBe('down');
  });

  it('an unreachable backend is down with no invented latency', async () => {
    mockFetch(() => new TypeError('Failed to fetch'));
    const result = await runProbe(probe);
    expect(result).toMatchObject({ state: 'down', status: null, latencyMs: null, error: 'Network error' });
  });

  it('sends the bearer token only to routes that need it', async () => {
    const { tokenStorage } = await import('@/core/auth/tokenStorage');
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => ({ body: {} }));
    await runProbe(HEALTH_PROBES.find((p) => !p.authenticated)!);
    await runProbe(HEALTH_PROBES.find((p) => p.authenticated)!);
    expect(calls[0].headers.get('Authorization')).toBeNull();
    expect(calls[1].headers.get('Authorization')).toBe('Bearer a1');
    tokenStorage.clearTokens();
  });
});

describe('ApiHealthPage', () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ApiHealthPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('shows measured results and tells the truth when everything is down', async () => {
    mockFetch(() => new TypeError('Failed to fetch'));
    renderPage();
    await waitFor(() => expect(screen.getByText(`${HEALTH_PROBES.length} of ${HEALTH_PROBES.length} checks failed.`)).toBeTruthy());
    expect(screen.queryByText(/Operational/)).toBeNull();
    expect(screen.queryByText(/99\.9/)).toBeNull();
  });

  it('shows a healthy backend, per-endpoint HTTP status and a manual re-check', async () => {
    const { calls } = mockFetch((call) => (new URL(call.url).pathname === '/api/v1/info/version/' ? { body: version.body } : { status: 403, body: {} }));
    renderPage();
    await waitFor(() => expect(screen.getByText('All checked endpoints answered.')).toBeTruthy());
    expect(screen.getAllByText('Reachable, not permitted').length).toBe(HEALTH_PROBES.length - 1);

    const before = calls.length;
    fireEvent.click(screen.getByRole('button', { name: /check now/i }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });
});

describe('health code', () => {
  it('contains no simulation or randomness', () => {
    const files = ['health/useApiHealth.ts', 'pages/ApiHealthPage.tsx'];
    const code = files.map((f) => fs.readFileSync(path.resolve(process.cwd(), 'src/modules/platform', f), 'utf8')).join('\n');
    expect(code).not.toMatch(/Math\.random|chaos|simulat/i);
  });
});
