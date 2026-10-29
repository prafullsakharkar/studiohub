import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { GroupsManagementSection } from '@/modules/access/components/GroupsManagementSection';

const state = {
  grants: [] as string[],
  groups: [
    { id: 'g1', name: 'Leads', code: 'LEAD', roles: ['lead'], memberUserIds: ['u1'], status: 'Active' },
  ] as any[],
};

vi.mock('@/modules/auth', () => ({
  useAuth: () => ({ user: { id: 'u0' }, can: (p: string) => state.grants.includes(p) }),
}));
vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u0' } }),
}));
vi.mock('@/modules/access/hooks/useAccessData', () => ({
  useGroups: () => ({ data: [] }),
  useRoles: () => ({ data: [] }),
}));
vi.mock('@/modules/people', () => ({
  usePeople: () => ({ data: { items: [], totalCount: 0 } }),
}));
vi.mock('@/core/access/useAccessManagementStore', () => ({
  useAccessManagementStore: () => ({
    groups: state.groups,
    getAllRoles: () => [],
    archiveGroup: vi.fn(),
    restoreGroup: vi.fn(),
    deleteGroup: vi.fn(),
    createGroup: vi.fn(),
    editGroup: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
    assignGroupRoles: vi.fn(),
  }),
}));

function renderCardMode() {
  localStorage.setItem('studiohub_entity_view_group', 'grid');
  render(
    <MemoryRouter>
      <GroupsManagementSection />
    </MemoryRouter>,
  );
}

describe('groups card-mode permission gating', () => {
  beforeEach(() => {
    localStorage.clear();
    state.grants = [];
  });

  it('hides card Edit/Delete/Create without grants', () => {
    renderCardMode();
    expect(screen.queryByTitle('Edit Group')).toBeNull();
    expect(screen.queryByTitle('Delete Group')).toBeNull();
    expect(screen.queryByRole('button', { name: /Create Access Group/i })).toBeNull();
  });

  it('shows card actions with grants', () => {
    state.grants = ['group.create', 'group.update', 'group.delete'];
    renderCardMode();
    expect(screen.getByTitle('Edit Group')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Group')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Access Group/i })).toBeInTheDocument();
  });
});
