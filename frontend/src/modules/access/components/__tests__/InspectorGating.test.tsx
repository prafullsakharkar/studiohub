import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { RolesWorkspaceSection } from '@/modules/access/components/RolesWorkspaceSection';
import { GroupsManagementSection } from '@/modules/access/components/GroupsManagementSection';
import { UserAccessSection } from '@/modules/access/components/UserAccessSection';

const state = {
  grants: [] as string[],
};

const accessStore = {
  groups: [
    { id: 'g1', name: 'Leads', code: 'LD', roles: ['lead'], memberUserIds: ['u1'], status: 'Active' },
  ],
  getAllRoles: () => [
    { id: 'r1', name: 'FX Lead', code: 'FXL', type: 'custom', category: 'Creative', permissions: [] },
  ],
  getUserEffectiveAccess: () => ({
    userRole: 'Artist',
    projectMemberships: [],
    groups: [],
    effectivePermissions: [],
  }),
  archiveGroup: vi.fn(),
  restoreGroup: vi.fn(),
  archiveRole: vi.fn(),
  restoreRole: vi.fn(),
  assignUserProjectRole: vi.fn(),
  getEffectiveRolePermissions: () => [],
};

vi.mock('@/modules/auth', () => ({
  useAuth: () => ({ user: { id: 'u0' }, can: (p: string) => state.grants.includes(p) }),
}));
vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u0' } }),
}));
vi.mock('@/modules/access/hooks/useAccessData', () => ({
  useRoles: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('@/modules/people', () => ({
  usePeople: () => ({
    data: {
      items: [
        {
          id: 'u1',
          full_name: 'A Artist',
          email: 'a@x.vfx',
          role: 'Artist',
          department_name: 'Comp',
          availability_status: 'Available',
        },
      ],
      totalCount: 1,
    },
  }),
}));
vi.mock('@/modules/production', () => ({
  useProjects: () => ({ data: { items: [], totalCount: 0 } }),
}));
vi.mock('@/core/production/useProductionStore', () => ({
  useProductionStore: () => ({ activeProjectId: null, setActiveProject: vi.fn() }),
}));
vi.mock('@/core/access/useAccessManagementStore', () => ({
  useAccessManagementStore: () => accessStore,
}));

function renderSection(ui: React.ReactElement) {
  localStorage.clear();
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('access inspector write gating', () => {
  beforeEach(() => {
    state.grants = [];
  });

  it('hides inspector write actions without grants', () => {
    renderSection(<RolesWorkspaceSection />);
    fireEvent.click(screen.getAllByText('FX Lead')[0]);
    expect(screen.queryByRole('button', { name: /Deploy Template/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit Matrix/i })).toBeNull();
  });

  it('hides group member/role actions without grants', () => {
    renderSection(<GroupsManagementSection />);
    fireEvent.click(screen.getAllByText('Leads')[0]);
    expect(screen.queryByRole('button', { name: /Add Member/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Group Roles/i })).toBeNull();
  });

  it('hides project assignment without grants', () => {
    renderSection(<UserAccessSection />);
    fireEvent.click(screen.getAllByText('A Artist')[0]);
    expect(screen.queryByRole('button', { name: /Assign Project/i })).toBeNull();
  });

  it('shows inspector actions with grants', () => {
    state.grants = ['roles.create', 'roles.update', 'group.update', 'people.update'];
    renderSection(<RolesWorkspaceSection />);
    fireEvent.click(screen.getAllByText('FX Lead')[0]);
    expect(screen.getByRole('button', { name: /Deploy Template/i })).toBeInTheDocument();
  });
});
