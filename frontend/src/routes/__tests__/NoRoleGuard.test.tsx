/**
 * NoRoleGuard: a signed-in user with no superuser flag, no permission and no project membership
 * sees only the "no role" page; anyone with a grant passes through.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NoRoleGuard } from '@/routes/NoRoleGuard';
import { hasAnyAccess } from '@/core/permissions/hasAnyAccess';
import type { User } from '@/types/identity';
import { loadSample } from '@/test/samples';

const logout = vi.fn();
let current: { user: User | null; isLoading: boolean } = { user: null, isLoading: false };

vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ ...current, isAuthenticated: current.user !== null }),
}));
vi.mock('@/modules/auth', () => ({
  useAuth: () => ({ user: current.user, logout }),
}));

const me = loadSample('identity/auth__me.json') as {
  list_admin: { body: User };
  list_norole: { body: User };
};
const noRole = me.list_norole.body;
const admin = me.list_admin.body;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NoRoleGuard />}>
          <Route path="*" element={<div data-testid="shell">APP</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('hasAnyAccess', () => {
  it('is false for the captured no-role account', () => {
    expect(hasAnyAccess(noRole)).toBe(false);
  });
  it('is false without a user', () => {
    expect(hasAnyAccess(null)).toBe(false);
  });
  it('is true for permissions, a project membership, or a superuser', () => {
    expect(hasAnyAccess({ ...noRole, permissions: ['project.view'] })).toBe(true);
    expect(hasAnyAccess({ ...noRole, project_memberships: [{ id: 'pm-1' } as never] })).toBe(true);
    expect(hasAnyAccess({ ...noRole, is_superuser: true })).toBe(true);
    expect(hasAnyAccess(admin)).toBe(true);
  });
});

describe('NoRoleGuard', () => {
  it.each(['/dashboard', '/people', '/clients', '/platform/catalog'])('closes %s to a user with no role', (path) => {
    current = { user: noRole, isLoading: false };
    renderAt(path);
    expect(screen.queryByTestId('shell')).toBeNull();
    expect(screen.getByText('No access yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('lets a user with a grant through', () => {
    current = { user: { ...noRole, permissions: ['project.view'] }, isLoading: false };
    renderAt('/dashboard');
    expect(screen.getByTestId('shell')).toBeTruthy();
  });

  it('renders nothing while the user is loading', () => {
    current = { user: null, isLoading: true };
    const { container } = renderAt('/dashboard');
    expect(container.innerHTML).toBe('');
  });
});
