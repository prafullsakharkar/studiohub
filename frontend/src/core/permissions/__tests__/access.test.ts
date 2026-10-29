import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/types/identity';
import { loadSample } from '@/test/samples';
import { __resetPermissionWarningsForTests, evaluateAccess } from '../access';

const flow = loadSample('identity/_auth_flow.json');
// Real /auth/me/ payloads: a superuser and a user with the seeded `artist` role.
const superuser = (flow.me_admin.body as { user?: User }).user ?? (flow.me_admin.body as unknown as User);
const artist = (flow.me_artist.body as { user?: User }).user ?? (flow.me_artist.body as unknown as User);

const withPerms = (permissions: string[], extra: Partial<User> = {}): User =>
  ({ id: 'u', email: 'u@x.test', role: 'Artist', is_active: true, is_superuser: false, permissions, project_memberships: [], ...extra }) as unknown as User;

beforeEach(() => __resetPermissionWarningsForTests());

describe('evaluateAccess with real /auth/me/ payloads', () => {
  it('the sample users are what the test assumes', () => {
    expect(superuser.is_superuser).toBe(true);
    expect(artist.is_superuser).toBe(false);
    expect(artist.permissions.length).toBeGreaterThan(0);
  });

  it('a user may do what their permissions list says, nothing else', () => {
    for (const code of artist.permissions) expect(evaluateAccess(artist, code)).toBe(true);
    expect(evaluateAccess(artist, 'identity.role.update')).toBe(false);
    expect(evaluateAccess(artist, 'masterdata.directory.manage')).toBe(false);
  });

  it('a superuser passes every backend-code check, including codes absent from their list (CR-07)', () => {
    expect(superuser.permissions).not.toContain('masterdata.directory.manage');
    expect(evaluateAccess(superuser, 'masterdata.directory.manage')).toBe(true);
    expect(evaluateAccess(superuser, 'identity.role.update')).toBe(true);
  });
});

describe('rule kinds', () => {
  it('open: any signed-in user, nobody else', () => {
    expect(evaluateAccess(withPerms([]), 'department.view')).toBe(true);
    expect(evaluateAccess(null, 'department.view')).toBe(false);
  });

  it('legacy write gates need the backend code', () => {
    expect(evaluateAccess(withPerms([]), 'department.create')).toBe(false);
    expect(evaluateAccess(withPerms(['masterdata.directory.manage']), 'department.create')).toBe(true);
    expect(evaluateAccess(withPerms(['masterdata.catalog.manage']), 'platform.software.update')).toBe(true);
  });

  it('unbacked: denied for everyone, superuser included (there is nothing behind the button)', () => {
    expect(evaluateAccess(superuser, 'asset.approve')).toBe(false);
    expect(evaluateAccess(superuser, 'reports.view')).toBe(false);
  });

  it('any/all targets', () => {
    expect(evaluateAccess(withPerms(['publishing.create']), 'delivery.publish')).toBe(true); // any-of
    expect(evaluateAccess(withPerms(['delivery.update']), 'delivery.publish')).toBe(true);
    expect(evaluateAccess(withPerms([]), 'delivery.publish')).toBe(false);
  });

  it('admin screens are for the people who can change what they edit', () => {
    expect(evaluateAccess(withPerms(['shot.view']), 'platform.admin.view')).toBe(false);
    expect(evaluateAccess(withPerms(['masterdata.catalog.manage']), 'platform.admin.view')).toBe(true);
    expect(evaluateAccess(withPerms(['identity.group.update']), 'page.permissions')).toBe(true);
  });

  it('denies unknown codes and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(evaluateAccess(superuser, 'totally.invented')).toBe(false);
    expect(evaluateAccess(superuser, 'totally.invented')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('denies inactive users and ignores role labels', () => {
    expect(evaluateAccess(withPerms(['shot.view'], { is_active: false }), 'shot.view')).toBe(false);
    expect(evaluateAccess(withPerms([], { role: 'Platform Admin' }), 'identity.role.update')).toBe(false);
  });
});

describe('project context', () => {
  const member = (status: string, extra: Record<string, unknown> = {}) =>
    withPerms(['shot.view'], {
      project_memberships: [{ id: 'm', user_id: 'u', project_id: 'P1', project_code: 'PRJ1', role: 'artist', status, ...extra }] as never,
    });

  it('needs an active membership for project data', () => {
    expect(evaluateAccess(member('active'), 'shot.view', { projectId: 'P1' })).toBe(true);
    expect(evaluateAccess(member('ACTIVE'), 'shot.view', { projectId: 'p1' })).toBe(true);
    expect(evaluateAccess(member('active'), 'shot.view', { projectId: 'PRJ1' })).toBe(true); // by code
    expect(evaluateAccess(member('active'), 'shot.view', { projectId: 'OTHER' })).toBe(false);
    for (const status of ['suspended', 'terminated', 'on_leave']) {
      expect(evaluateAccess(member(status), 'shot.view', { projectId: 'P1' })).toBe(false);
    }
  });

  it('membership alone grants nothing: the permission is still required', () => {
    expect(evaluateAccess(member('active'), 'shot.update', { projectId: 'P1' })).toBe(false);
  });

  it('a show-scoped membership does not reach other shows', () => {
    const scoped = member('active', { scope: 'SHOW', show_id: 'S1' });
    expect(evaluateAccess(scoped, 'shot.view', { projectId: 'P1', showId: 'S1' })).toBe(true);
    expect(evaluateAccess(scoped, 'shot.view', { projectId: 'P1', showId: 'S2' })).toBe(false);
  });

  it('a superuser needs no membership', () => {
    expect(evaluateAccess(superuser, 'shot.view', { projectId: 'anything' })).toBe(true);
  });
});
