import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';

const flow = loadSample('identity/_auth_flow.json');
const artist = flow.me_artist.body as unknown as User;
const meCalls = (calls: MockCall[]) => calls.filter((c) => c.method === 'GET' && new URL(c.url).pathname === '/api/v1/auth/me/');

function Probe() {
  const auth = useContext(AuthContext);
  return <p>{auth?.isLoading ? 'loading' : (auth?.user?.email ?? 'nobody')}</p>;
}

afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('signing in again after a reload', () => {
  it('asks /auth/me once although StrictMode runs the start-up effect twice', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: artist, delayMs: 20 }));
    tokenStorage.setTokens({ access: 'a', refresh: 'r' });
    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>
    );

    await waitFor(() => expect(screen.getByText(artist.email)).toBeTruthy());
    expect(meCalls(calls)).toHaveLength(1);
  });

  it('refreshUser still asks again: it is not served the start-up answer', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: artist }));
    tokenStorage.setTokens({ access: 'a', refresh: 'r' });
    let refreshUser: (() => Promise<void>) | undefined;
    function Grab() {
      refreshUser = useContext(AuthContext)?.refreshUser as () => Promise<void>;
      return <Probe />;
    }
    render(
      <AuthProvider>
        <Grab />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(artist.email)).toBeTruthy());
    expect(meCalls(calls)).toHaveLength(1);

    await refreshUser?.();
    expect(meCalls(calls)).toHaveLength(2);
  });
});
