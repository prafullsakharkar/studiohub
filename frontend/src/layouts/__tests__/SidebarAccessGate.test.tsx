import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render as renderDom, screen } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/core/auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));

import { Sidebar } from '../Sidebar';
import { useCurrentUser } from '@/core/auth/useCurrentUser';

// The Sidebar reads the chosen project (Episodes item, CR-47), so it renders under a query client as in the app.
const render = (ui: React.ReactElement) =>
  renderDom(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

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
  it('does not show platform entries to a non-admin member', () => {
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
    expect(screen.queryByRole('link', { name: /API Health/i })).toBeNull();
  });

  it('exposes the platform entries to a true superuser, and no Platform Admin link any more', () => {
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
    expect(screen.getByRole('link', { name: /API Health/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Platform Admin/i })).toBeNull();
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

  it('shows the Shots entry without a made-up cut count', () => {
    userSpy.mockReturnValue({
      user: { ...baseUser, is_superuser: true },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    // The label used to carry a hardcoded "18 Cut" badge that no data backed.
    expect(screen.getByRole('link', { name: /^Shots$/ })).toBeTruthy();
    expect(screen.queryByText(/18\s*Cut/i)).toBeNull();
  });

  it('shows no hardcoded badge text on any entry', () => {
    userSpy.mockReturnValue({
      user: { ...baseUser, is_superuser: true },
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    // Entries used to carry fixed badge text (RBAC, Live, USD/EXR, Aspera, 3 Dailies, ...) with no data behind it.
    // An entry is now an icon and its label span, nothing else.
    const links = screen.getAllByRole('link') as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      expect(link.querySelectorAll('span').length).toBeLessThanOrEqual(1);
    }
  });
});
