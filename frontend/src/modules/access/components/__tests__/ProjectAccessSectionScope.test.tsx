/**
 * Task 12 (de-org): ProjectAccessSection renders its target production
 * dropdown through `filterAccessibleProjects` — unassigned and archived
 * projects must never be offered, even though the query hook returns every
 * flat platform row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const state = {
  user: null as any,
  projects: [] as any[],
};

vi.mock('@/modules/access/hooks/useAccessData', () => ({
  useRoles: () => ({ data: [] }),
}));
vi.mock('@/modules/people', () => ({
  usePeople: () => ({ data: { items: [], totalCount: 0 }, isLoading: false }),
}));
vi.mock('@/modules/production', () => ({
  useProjects: () => ({ data: { results: state.projects, count: state.projects.length }, isLoading: false }),
}));

vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: state.user }),
}));

vi.mock('@/core/access/useAccessManagementStore', () => ({
  useAccessManagementStore: () => ({
    selectedProjectId: '',
    setSelectedProjectId: vi.fn(),
    getAllRoles: () => [],
    assignUserProjectRole: vi.fn(),
    removeUserFromProject: vi.fn(),
    getUserEffectiveAccess: () => ({ projectMemberships: [] }),
  }),
}));

vi.mock('@/core/production/useProductionStore', () => ({
  useProductionStore: () => ({ activeProjectId: null, setActiveProject: vi.fn() }),
}));

function projectFixture(id: string, status = 'In Progress') {
  return {
    id,
    code: id.toUpperCase(),
    name: `Project ${id}`,
    status,
  };
}

describe('ProjectAccessSection target dropdown scoping', () => {
  beforeEach(() => {
    state.user = {
      id: 'u-plain',
      email: 'artist@studiohub.vfx',
      is_superuser: false,
      is_active: true,
      role: 'Artist',
      project_memberships: [{ project_id: 'proj-a1', status: 'active' }],
    };
    state.projects = [
      projectFixture('proj-a1'),
      projectFixture('proj-a2'),
      projectFixture('proj-archived', 'Archived'),
    ];
  });

  it('offers only assigned active projects in the target dropdown', async () => {
    const { ProjectAccessSection } = await import('../ProjectAccessSection');
    render(
      <MemoryRouter>
        <ProjectAccessSection />
      </MemoryRouter>
    );
    const select = screen.getByLabelText('Select Target Production');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options.some((t) => t?.includes('proj-a1'))).toBe(true);
    expect(options.some((t) => t?.includes('proj-a2'))).toBe(false);
    expect(options.some((t) => t?.includes('proj-archived'))).toBe(false);
  });

  it('offers every active project to a superuser', async () => {
    state.user = { ...state.user, is_superuser: true };
    const { ProjectAccessSection } = await import('../ProjectAccessSection');
    render(
      <MemoryRouter>
        <ProjectAccessSection />
      </MemoryRouter>
    );
    const select = screen.getByLabelText('Select Target Production');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options.some((t) => t?.includes('proj-a1'))).toBe(true);
    expect(options.some((t) => t?.includes('proj-a2'))).toBe(true);
    expect(options.some((t) => t?.includes('proj-archived'))).toBe(false);
  });
});
