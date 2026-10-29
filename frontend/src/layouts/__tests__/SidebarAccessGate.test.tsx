import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/core/auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));

import { Sidebar } from '../Sidebar';
import { useCurrentUser } from '@/core/auth/useCurrentUser';

const userSpy = useCurrentUser as unknown as { mockReturnValue: (v: unknown) => void };

const baseUser = {
  id: 'u-1',
  email: 'member@studiohub.vfx',
  is_superuser: false,
  is_active: true,
  role: 'Platform Admin',
  permissions: [],
  memberships: [{ organization_id: 'org-1', role: 'Artist', status: 'Active' }],
};

describe('Sidebar access gate', () => {
  it('does not show Platform Admin entries to a non-admin member', () => {
    userSpy.mockReturnValue({
      user: {
        ...baseUser,
        role: 'Artist',
        memberships: [{ organization_id: 'org-1', role: 'Artist', status: 'Active' }],
        permissions: [],
      },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    // nav no longer bypassed by labels: every item goes through permission evaluation
    expect(screen.queryByRole('link', { name: /Platform Admin/i })).toBeNull();
  });

  it('exposes Platform Admin to a true superuser', () => {
    userSpy.mockReturnValue({
      user: {
        ...baseUser,
        is_superuser: true,
      },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Platform Admin/i })).toBeTruthy();
  });
});

describe('Sidebar direct navigation (org-free)', () => {
  it('links production/platform sections directly, with no organization deep links', () => {
    userSpy.mockReturnValue({
      user: { ...baseUser, is_superuser: true },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Production is the primary workspace: flat links, no org path segment.
    expect(screen.getByRole('link', { name: /^Projects$/i }).getAttribute('href')).toBe(
      '/projects',
    );
    expect(screen.getByRole('link', { name: /^Shots/ }).getAttribute('href')).toBe(
      '/shots',
    );
    expect(screen.getByRole('link', { name: /^Tasks$/i }).getAttribute('href')).toBe(
      '/tasks',
    );

    // No studio/org workspace tab links survive.
    const links = screen.getAllByRole('link') as HTMLAnchorElement[];
    const hrefs = links.map((l) => l.getAttribute('href') || '');
    expect(hrefs.some((h) => h.startsWith('/organizations/'))).toBe(false);
    expect(screen.queryByRole('link', { name: /^Organizations$/i })).toBeNull();
  });

  it('hides links whose permission is not granted', () => {
    userSpy.mockReturnValue({
      user: {
        ...baseUser,
        role: 'Artist',
        permissions: ['page.project.shots', 'shot.view'],
      },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /^Shots/ })).toBeTruthy();
    // Deliveries requires delivery.view + page.project.deliveries: not granted.
    expect(screen.queryByRole('link', { name: /^Deliveries$/i })).toBeNull();
  });
});
