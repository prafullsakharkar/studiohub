import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { rolesApi } from '@/api/identity/rbac';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { useAuth } from '@/modules/auth';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useCan } from '@/core/permissions/useCan';
import { AccountSection } from '@/modules/identity/components/AccountSection';
import { SecurityPage } from '@/modules/identity/account/SecurityPage';
import { RoleDetailPage } from '@/modules/identity/pages/RoleDetailPage';
import { authService } from '@/modules/auth/services/AuthService';
import { freshTotp, live, rawPost, totp } from './liveBackend';

/**
 * Phase 2 exit criteria against a REAL backend (docs/sync/tools/live_backend.py):
 *  1. an administrator creates a login for a person and assigns a role; that user's next
 *     /auth/me shows the new permissions;
 *  2. the UI reacts: assigning a role to yourself re-reads /auth/me and the permission gate flips;
 *  3. MFA: voluntary enrollment from My account, then sign-in with a challenge.
 */
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signInManager() {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
}

describe('administrator creates a login, assigns a role, and the user sees the permissions', () => {
  it('Create login (two calls) → assign role → the new user’s /auth/me lists shot.view', async () => {
    await signInManager();
    const person = await apiClient.post<{ id: string }>('/api/v1/people/', { name: 'Live Person' });
    const email = `live-person-${Date.now()}@example.test`;
    const password = 'Live-Person-Pass!42';

    render(tree(<AccountSection personId={person.id} personName="Live Person" personEmail={email} userId={null} />));

    // 1. Create login: POST /identity/users/ then POST /people/{id}/link-user/.
    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));
    await waitFor(async () => expect((await apiClient.get<{ user: string | null }>(`/api/v1/people/${person.id}/`)).user).toBeTruthy(), { timeout: 15000 });
    const linked = await apiClient.get<{ user: string }>(`/api/v1/people/${person.id}/`);

    // 2. The section follows the link: render it again with the linked id and assign the role.
    cleanup();
    render(tree(<AccountSection personId={person.id} personName="Live Person" personEmail={email} userId={linked.user} />));
    expect(await screen.findByText(email, {}, { timeout: 15000 })).toBeTruthy();
    fireEvent.change(await screen.findByLabelText('Assign role', {}, { timeout: 15000 }), { target: { value: (await rolesApi.list({ search: 'live-viewer' })).results[0].id } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(await screen.findByRole('button', { name: 'Remove role Live Viewer' }, { timeout: 15000 })).toBeTruthy();

    // 3. The user signs in and /auth/me carries the role's permission.
    const login = await rawPost('/api/v1/auth/login/', { email, password });
    expect(login.status).toBe(200);
    const me = await fetch(`${live.url}/api/v1/auth/me/`, { headers: { Authorization: `Bearer ${login.body.tokens.access}` } }).then((r) => r.json());
    expect(me.permissions).toContain('shot.view');
    expect(me.role).toBe('Live Viewer');
  }, 90000);
});

/** A bearer token for the MFA-enrolled superuser, obtained over raw HTTP so it can act while another user is signed in. */
async function managerBearer(): Promise<string> {
  const first = await rawPost('/api/v1/auth/login/', live.users.manager);
  const done = await rawPost('/api/v1/auth/mfa/challenge/', { challenge: first.body.challenge, code: await freshTotp(live.manager.secret) });
  return done.body.tokens.access as string;
}

describe('the UI reacts to a permission change made by an administrator', () => {
  const Probe: React.FC = () => {
    const { refreshUser } = useAuth();
    return (
      <div>
        <div data-testid="probe">{useCan('shot.view') ? 'can-view-shots' : 'cannot-view-shots'}</div>
        <button type="button" onClick={() => void refreshUser()}>
          reload me
        </button>
      </div>
    );
  };

  it('another user’s role assignment shows up in useCan after /auth/me is re-read, without a reload', async () => {
    const bearer = await managerBearer();
    const admin = (path: string, init: RequestInit) => fetch(`${live.url}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` } });
    const email = `live-react-${Date.now()}@example.test`;
    const password = 'Live-React-Pass!42';
    const created = await (await admin('/api/v1/identity/users/', { method: 'POST', body: JSON.stringify({ email, password }) })).json();
    expect(created.id).toBeTruthy();

    // The target signs in through the real provider and starts without the permission.
    await authService.login({ email, password });
    render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('cannot-view-shots'), { timeout: 15000 });

    // The administrator assigns the role (a different session).
    const viewerList = await (await admin('/api/v1/roles/?search=live-viewer', { method: 'GET' })).json();
    const assigned = await admin(`/api/v1/roles/${viewerList.results[0].id}/users/`, { method: 'POST', body: JSON.stringify({ user_id: created.id }) });
    expect(assigned.status).toBe(201);

    // The target's next /auth/me carries the permission and the gate flips.
    fireEvent.click(screen.getByRole('button', { name: 'reload me' }));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('can-view-shots'), { timeout: 15000 });
  }, 90000);

  it('the backend refuses self-service changes: escalation to permissions you lack, and editing your own assignments', async () => {
    await authService.login(live.users.delegate);
    const me = await apiClient.get<{ id: string }>('/api/v1/auth/me/');
    const escalation = (await rolesApi.list({ search: 'live-escalation' })).results[0];
    await expect(rolesApi.assignUser(escalation.id, me.id)).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/does not hold every permission/i) });

    const viewer = (await rolesApi.list({ search: 'live-viewer' })).results[0];
    await expect(rolesApi.unassignUser(viewer.id, me.id)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/cannot modify your own role assignments/i) });
  }, 30000);
});

describe('MFA from My account, then a sign-in that needs the challenge', () => {
  it('enroll voluntarily → recovery codes → sign in again with a challenge → regenerate and turn off with recovery codes', async () => {
    await authService.login(live.users.selfmfa);
    render(tree(<SecurityPage />));

    // Enroll: the pending secret is created only when asked.
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on' }, { timeout: 15000 }));
    const secret = (await screen.findByText(/^[A-Z2-7]{32}$/, {}, { timeout: 15000 })).textContent as string;
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: await freshTotp(secret) } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));
    const list = await screen.findByLabelText('Recovery codes', {}, { timeout: 15000 });
    const codes = [...list.querySelectorAll('li')].map((li) => li.textContent as string);
    expect(codes).toHaveLength(10);
    fireEvent.click(screen.getByLabelText(/i have saved/i));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('On', {}, { timeout: 15000 })).toBeTruthy();

    // A new sign-in is now challenged; the code from the enrolled secret completes it.
    const challenged = await rawPost('/api/v1/auth/login/', live.users.selfmfa);
    expect(challenged.body.mfa_required).toBe(true);
    expect(challenged.body.tokens).toBeUndefined();
    const done = await rawPost('/api/v1/auth/mfa/challenge/', { challenge: challenged.body.challenge, code: await freshTotp(secret) });
    expect(done.status).toBe(200);
    expect(done.body.tokens.access).toBeTruthy();

    // Regenerate recovery codes: password + a recovery code (no wait for the next TOTP step).
    fireEvent.click(await screen.findByRole('button', { name: 'Generate new codes' }, { timeout: 15000 }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /use a recovery code instead/i }));
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: live.users.selfmfa.password } });
    fireEvent.change(within(dialog).getByLabelText('Recovery code'), { target: { value: codes[0] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate' }));
    const fresh = await screen.findByLabelText('New recovery codes', {}, { timeout: 15000 });
    const freshCodes = [...fresh.querySelectorAll('li')].map((li) => li.textContent as string);
    expect(freshCodes).toHaveLength(10);
    expect(freshCodes).not.toContain(codes[1]); // the old set is replaced
    fireEvent.click(screen.getByRole('button', { name: 'I saved them' }));

    // Turn off with one of the NEW recovery codes.
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off' }, { timeout: 15000 }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /use a recovery code instead/i }));
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: live.users.selfmfa.password } });
    fireEvent.change(within(dialog).getByLabelText('Recovery code'), { target: { value: freshCodes[0] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByRole('button', { name: 'Turn on' }, { timeout: 15000 })).toBeTruthy();
    void totp;
  }, 120000);
});
