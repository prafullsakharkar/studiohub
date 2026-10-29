import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import type { User } from '@/types/identity';
import { loadSample } from '@/test/samples';
import { useCan } from '../useCan';

const flow = loadSample('identity/_auth_flow.json');
const artist = flow.me_artist.body as unknown as User;
const admin = flow.me_admin.body as unknown as User;

const asUser = (user: User | null) => ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={{ user } as AuthContextValue}>{children}</AuthContext.Provider>
);

describe('useCan', () => {
  it('follows the signed-in user’s backend permissions', () => {
    const first = artist.permissions[0];
    expect(renderHook(() => useCan(first), { wrapper: asUser(artist) }).result.current).toBe(true);
    expect(renderHook(() => useCan('identity.role.update'), { wrapper: asUser(artist) }).result.current).toBe(false);
  });

  it('is true for a superuser, except for controls that have no backend', () => {
    expect(renderHook(() => useCan('identity.role.update'), { wrapper: asUser(admin) }).result.current).toBe(true);
    expect(renderHook(() => useCan('asset.approve'), { wrapper: asUser(admin) }).result.current).toBe(false);
  });

  it('several codes: all by default, any on request', () => {
    const [first] = artist.permissions;
    const codes = [first, 'identity.role.update'];
    expect(renderHook(() => useCan(codes), { wrapper: asUser(artist) }).result.current).toBe(false);
    expect(renderHook(() => useCan(codes, { mode: 'any' }), { wrapper: asUser(artist) }).result.current).toBe(true);
  });

  it('is false with no user and with no provider (never throws)', () => {
    expect(renderHook(() => useCan('shot.view'), { wrapper: asUser(null) }).result.current).toBe(false);
    expect(renderHook(() => useCan('shot.view')).result.current).toBe(false);
    expect(renderHook(() => useCan([]), { wrapper: asUser(admin) }).result.current).toBe(false);
  });

  it('project data needs membership', () => {
    const [code] = artist.permissions;
    const member = { ...artist, project_memberships: [{ project_id: 'P1', status: 'active' }] } as unknown as User;
    expect(renderHook(() => useCan(code, { projectId: 'P1' }), { wrapper: asUser(member) }).result.current).toBe(true);
    expect(renderHook(() => useCan(code, { projectId: 'P2' }), { wrapper: asUser(member) }).result.current).toBe(false);
  });
});
