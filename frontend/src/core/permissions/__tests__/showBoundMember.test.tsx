import { renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { useProductionStore } from '@/core/production/useProductionStore';
import type { User } from '@/types/identity';
import { loadSample } from '@/test/samples';
import { usePermissions } from '../usePermissions';

const flow = loadSample('identity/_auth_flow.json');
const artist = flow.me_artist.body as unknown as User;
const code = artist.permissions[0];

/** A member whose membership the backend binds to ONE show of the project (`scope: SHOW`, a real `show_id`). */
const showBound = (showId: string): User =>
  ({ ...artist, project_memberships: [{ project_id: 'project-1', status: 'active', scope: 'SHOW', show_id: showId }] }) as unknown as User;

const asUser = (user: User) => ({ children }: { children: React.ReactNode }) => <AuthContext.Provider value={{ user } as AuthContextValue}>{children}</AuthContext.Provider>;

afterEach(() => useProductionStore.setState({ activeProjectId: null }));

describe('permissions for a member bound to one show', () => {
  it('are not denied because of a show the app made up: the chosen project carries no show', () => {
    useProductionStore.setState({ activeProjectId: 'project-1' });
    const { result } = renderHook(() => usePermissions(), { wrapper: asUser(showBound('7f0c9a52-0000-4000-8000-000000000001')) });
    expect(result.current.can(code)).toBe(true);
  });

  it('still hold when the caller names that member’s own show, and are refused for another show', () => {
    useProductionStore.setState({ activeProjectId: 'project-1' });
    const { result } = renderHook(() => usePermissions(), { wrapper: asUser(showBound('show-a')) });
    expect(result.current.can({ permission: code, showId: 'show-a' })).toBe(true);
    expect(result.current.can({ permission: code, showId: 'show-b' })).toBe(false);
  });
});
