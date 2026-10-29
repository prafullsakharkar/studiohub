import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { credentialsApi, sessionsApi } from '../account';
import { ledgersApi } from '../ledgers';
import { groupsApi, permissionsApi, rolesApi } from '../rbac';
import { personLinkApi, usersApi } from '../users';

const flow = loadSample<Record<string, { status: number; body: any }>>('identity/_identity_admin_flow.json');
const reply = (c: { status: number; body: unknown }): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const search = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
});
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('roles and groups', () => {
  it('create reads the row back by code because the 201 carries no id (Q-07)', async () => {
    const created = flow.roles_create; // {name, code, description, ...} with no id: the real response
    expect(created.body.id).toBeUndefined();
    const list = { count: 1, next: null, previous: null, results: [{ id: 'role-1', code: 'reviewer', name: 'Reviewer' }] };
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(created) : { body: list }));

    const role = await rolesApi.create({ name: 'Reviewer', code: 'reviewer' });

    expect(role.id).toBe('role-1');
    expect(calls.map((c) => `${c.method} ${path(c)}${c.method === 'GET' ? `?search=${search(c).search}` : ''}`)).toEqual(['POST /api/v1/roles/', 'GET /api/v1/roles/?search=reviewer']);
  });

  it('create fails loudly if the row cannot be found afterwards', async () => {
    mockFetch((c) => (c.method === 'POST' ? reply(flow.groups_create) : { body: { count: 0, next: null, previous: null, results: [] } }));
    await expect(groupsApi.create({ name: 'x', code: 'x' })).rejects.toThrow(/was not found/);
  });

  it('create surfaces the server’s duplicate-code error untouched', async () => {
    mockFetch(() => reply(flow.roles_create_duplicate_code));
    await expect(rolesApi.create({ name: 'Reviewer 2', code: 'reviewer' })).rejects.toMatchObject({ status: 400, fieldErrors: { code: ['role with this code already exists.'] } });
  });

  it('grant sends permission_id (+ expires_at only when given); revoke sends a DELETE body', async () => {
    const { calls } = mockFetch((c) => reply(c.method === 'POST' ? flow.roles_permissions_grant : flow.roles_permissions_revoke));
    await rolesApi.grantPermission('r1', 'p1');
    await rolesApi.grantPermission('r1', 'p2', '2030-01-01T00:00:00Z');
    await rolesApi.revokePermission('r1', 'p1');

    expect(calls.map((c) => [c.method, path(c), c.body])).toEqual([
      ['POST', '/api/v1/roles/r1/permissions/', { permission_id: 'p1' }],
      ['POST', '/api/v1/roles/r1/permissions/', { permission_id: 'p2', expires_at: '2030-01-01T00:00:00Z' }],
      ['DELETE', '/api/v1/roles/r1/permissions/', { permission_id: 'p1' }],
    ]);
  });

  it('assign/unassign user, attach/detach role and group members use the real body keys', async () => {
    const { calls } = mockFetch(() => ({ body: { detail: 'ok' } }));
    await rolesApi.assignUser('r1', 'u1');
    await rolesApi.unassignUser('r1', 'u1');
    await groupsApi.addMember('g1', 'u1', { is_owner: true });
    await groupsApi.removeMember('g1', 'u1');
    await groupsApi.attachRole('g1', 'r1');
    await groupsApi.detachRole('g1', 'r1');

    expect(calls.map((c) => [c.method, path(c).replace('/api/v1', ''), c.body])).toEqual([
      ['POST', '/roles/r1/users/', { user_id: 'u1' }],
      ['DELETE', '/roles/r1/users/', { user_id: 'u1' }],
      ['POST', '/groups/g1/members/', { user_id: 'u1', is_owner: true }],
      ['DELETE', '/groups/g1/members/', { user_id: 'u1' }],
      ['POST', '/groups/g1/roles/', { role_id: 'r1' }],
      ['DELETE', '/groups/g1/roles/', { role_id: 'r1' }],
    ]);
  });

  it('deleting a system role is the server’s 400, shown as-is', async () => {
    mockFetch(() => reply(flow.roles_delete_system));
    await expect(rolesApi.remove('artist')).rejects.toMatchObject({ status: 400, nonFieldErrors: ['System records cannot be deleted.'] });
  });

  it('the permission catalog is fetched whole (page_size 500)', async () => {
    const { calls } = mockFetch(() => ({ body: { count: 1, next: null, previous: null, results: [{ id: 'p', code: 'shot.view' }] } }));
    expect(await permissionsApi.all()).toHaveLength(1);
    expect(search(calls[0])).toMatchObject({ page_size: '500', ordering: 'code' });
  });
});

describe('users', () => {
  it('lifecycle actions hit the right URL segment', async () => {
    const { calls } = mockFetch(() => ({ body: { detail: 'ok' } }));
    for (const action of ['activate', 'suspend', 'resetPassword', 'forcePasswordChange', 'revokeSessions'] as const) await usersApi.act('u1', action);
    expect(calls.map((c) => path(c).replace('/api/v1/identity/users/u1/', ''))).toEqual(['activate/', 'suspend/', 'reset-password/', 'force-password-change/', 'revoke-sessions/']);
  });

  it('a duplicate e-mail that differs by case is the backend’s 500 (CR-12): it surfaces as a server error with its request id', async () => {
    mockFetch(() => reply(flow.users_create_duplicate_case));
    await expect(usersApi.create({ email: 'NEW@example.test', password: 'x' })).rejects.toMatchObject({ status: 500, requestId: expect.any(String) });
  });

  it('link-user conflicts are a 409 with the server’s message', async () => {
    mockFetch(() => reply(flow.people_link_user_already_linked));
    await expect(personLinkApi.link('p1', 'u1')).rejects.toMatchObject({ status: 409, message: 'This user is already linked to another person.' });
  });
});

describe('account', () => {
  it('a new credential shows its secret once; the list never does', async () => {
    mockFetch((c) => reply(c.method === 'POST' ? flow.pat_create : flow.pat_list));
    const issued = await credentialsApi.create('tokens', { name: 'CI token', scopes: ['asset.create'] });
    expect(Object.keys(issued)).toContain('secret');
    const listed = await credentialsApi.listAll('tokens');
    expect(listed.every((c) => !('secret' in c))).toBe(true);
  });

  it('listing can include revoked credentials, and uses the right base per kind', async () => {
    const { calls } = mockFetch(() => ({ body: { count: 0, next: null, previous: null, results: [] } }));
    await credentialsApi.listAll('keys', true);
    expect(path(calls[0])).toBe('/api/v1/identity/api-keys/');
    expect(search(calls[0])).toMatchObject({ include_revoked: 'true' });
  });

  it('a scope the user does not hold is the server’s 400 (detail is a list)', async () => {
    mockFetch(() => reply(flow.pat_create_scope_not_held));
    await expect(credentialsApi.create('tokens', { name: 'x', scopes: ['identity.role.update'] })).rejects.toMatchObject({ status: 400, message: "You do not hold 'identity.role.update'." });
  });

  it('sessions: revoke-all-other returns how many were ended', async () => {
    mockFetch(() => reply(flow.sessions_revoke_all_other));
    expect(await sessionsApi.revokeAllOther()).toEqual({ sessions: 0 });
  });
});

describe('ledgers', () => {
  it('always send the date window the caller gives and never ask for "everything" implicitly', async () => {
    const { calls } = mockFetch(() => reply(flow.ledger_security_events));
    await ledgersApi.securityEvents({ start_date: '2026-10-01', end_date: '2026-10-29' });
    expect(search(calls[0])).toEqual({ start_date: '2026-10-01', end_date: '2026-10-29' });
  });

  it('invalid IP is the server’s field error', async () => {
    mockFetch(() => reply(flow.ledger_ip_blacklist_create_invalid));
    await expect(ledgersApi.addIp({ ip_address: 'not-an-ip' })).rejects.toMatchObject({ fieldErrors: { ip_address: ['Enter a valid IPv4 or IPv6 address.'] } });
  });
});
