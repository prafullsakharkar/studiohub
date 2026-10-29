import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/core/masterData/useMasterData', () => ({
  usePlatformGroups: () => ({
    data: [
      {
        id: 'g1',
        name: 'Pipeline TDs',
        code: 'PIPE_TD',
        description: 'Platform template catalog entry.',
        roles: ['Supervisor'],
        member_count: 3,
      },
    ],
    isLoading: false,
  }),
  useCreatePlatformGroup: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePlatformGroup: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePlatformGroup: () => ({ mutate: vi.fn(), isPending: false }),
  usePlatformRoles: () => ({ data: [] }),
}));

import { GroupsSection } from '@/modules/platform/admin/masterData/OrgStructure/GroupsSection';

function renderSection() {
  return render(
    <MemoryRouter>
      <GroupsSection searchQuery="" />
    </MemoryRouter>,
  );
}

describe('platform GroupsSection read-only catalog', () => {
  it('lists the platform group catalog', () => {
    renderSection();
    expect(screen.getByText('Pipeline TDs')).toBeTruthy();
    expect(screen.getByText('PIPE_TD')).toBeTruthy();
  });

  it('offers no create/edit/delete affordances', () => {
    renderSection();
    expect(screen.queryByText('New Group')).toBeNull();
    expect(screen.queryByText('Create First Group')).toBeNull();
    expect(screen.queryByText('Create Group')).toBeNull();
    expect(screen.queryByText('Save Group')).toBeNull();
    expect(screen.queryByText('Delete Permanently')).toBeNull();
  });

  it('points to the canonical access manager', () => {
    renderSection();
    const link = screen.getByRole('link', { name: /manage.*access/i });
    expect(link.getAttribute('href')).toBe('/access/groups');
  });
});
