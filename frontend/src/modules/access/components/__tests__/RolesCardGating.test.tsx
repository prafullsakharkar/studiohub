import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { RolesWorkspaceSection } from '@/modules/access/components/RolesWorkspaceSection';

const state = {
  grants: [] as string[],
  roles: [
    { id: 'r1', name: 'FX Lead', code: 'FXL', type: 'custom', category: 'Creative', permissions: ['shot.view'] },
  ] as any[],
};

vi.mock('@/modules/auth', () => ({
  useAuth: () => ({ user: { id: 'u0' }, can: (p: string) => state.grants.includes(p) }),
}));
vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u0' } }),
}));
vi.mock('@/modules/access/hooks/useAccessData', () => ({
  useRoles: () => ({ data: [] }),
}));
vi.mock('@/modules/people', () => ({
  usePeople: () => ({ data: { items: [], totalCount: 0 } }),
}));
vi.mock('@/core/access/useAccessManagementStore', () => ({
  useAccessManagementStore: () => ({
    groups: [],
    getAllRoles: () => state.roles,
    cloneRole: vi.fn(),
    archiveRole: vi.fn(),
    restoreRole: vi.fn(),
    deleteRole: vi.fn(),
    createRoleFromTemplate: vi.fn(),
    getEffectiveRolePermissions: () => [],
  }),
}));

function renderCardMode() {
  localStorage.setItem('studiohub_entity_view_role', 'grid');
  render(
    <MemoryRouter>
      <RolesWorkspaceSection />
    </MemoryRouter>,
  );
}

describe('roles card-mode permission gating', () => {
  beforeEach(() => {
    localStorage.clear();
    state.grants = [];
  });

  it('hides card Clone/Edit/Delete/Create without grants', () => {
    renderCardMode();
    expect(screen.queryByTitle('Clone Role')).toBeNull();
    expect(screen.queryByTitle('Edit Permissions & Metadata')).toBeNull();
    expect(screen.queryByTitle('Delete Custom Role')).toBeNull();
    expect(screen.queryByRole('button', { name: /Create Role/i })).toBeNull();
  });

  it('shows card actions with grants', () => {
    state.grants = ['roles.create', 'roles.update', 'roles.delete'];
    renderCardMode();
    expect(screen.getByTitle('Clone Role')).toBeInTheDocument();
    expect(screen.getByTitle('Edit Permissions & Metadata')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Custom Role')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Role/i })).toBeInTheDocument();
  });
});
