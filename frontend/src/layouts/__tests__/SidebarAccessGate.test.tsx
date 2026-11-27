import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render as renderDom, screen } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/core/auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));

import { Sidebar } from '../Sidebar';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { ROUTE_PERMISSIONS_REGISTRY } from '@/core/permissions/routePermissionsRegistry';

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

describe('Sidebar playlists entry', () => {
  const mount = (permissions: string[], is_superuser = false) => {
    userSpy.mockReturnValue({ user: { ...baseUser, is_superuser, role: 'Artist', permissions } });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
  };

  it('links the playlists list right after Reviews', () => {
    mount([], true);
    const link = screen.getByRole('link', { name: /^Playlists$/ });
    expect(link.getAttribute('href')).toBe('/playlists');
    const hrefs = (screen.getAllByRole('link') as HTMLAnchorElement[]).map((a) => a.getAttribute('href'));
    expect(hrefs.indexOf('/playlists')).toBe(hrefs.indexOf('/reviews') + 1);
  });

  it('is shown under the same codes as the /playlists route', () => {
    mount(ROUTE_PERMISSIONS_REGISTRY['/playlists'].permissions ?? []);
    expect(screen.getByRole('link', { name: /^Playlists$/ })).toBeTruthy();
  });

  it('is hidden from a member who may not view playlists', () => {
    mount(['page.project.reviews', 'review.view']);
    expect(screen.getByRole('link', { name: /^Reviews/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Playlists$/ })).toBeNull();
  });
});

describe('Sidebar settings section', () => {
  const settingsLinks = (permissions: string[], is_superuser = false) => {
    userSpy.mockReturnValue({ user: { ...baseUser, is_superuser, role: 'Artist', permissions } });
    const { unmount } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    const hrefs = (screen.queryAllByRole('link') as HTMLAnchorElement[])
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/settings/'));
    unmount();
    return hrefs.sort();
  };

  // Every system settings screen (a /settings/system/<screen> route, not its new or edit form).
  const screens = Object.keys(ROUTE_PERMISSIONS_REGISTRY)
    .filter((path) => /^\/settings\/system\/[a-z]+$/.test(path))
    .sort();

  it('links every system settings screen for a superuser', () => {
    expect(screens).toContain('/settings/system/directory');
    expect(screens.length).toBe(8);
    expect(settingsLinks([], true)).toEqual(screens);
  });

  it('links each screen under the same code as its route', () => {
    for (const path of screens) {
      expect(settingsLinks(ROUTE_PERMISSIONS_REGISTRY[path].permissions ?? [])).toContain(path);
    }
  });

  it('gives settings.view the settings screens, not the directory', () => {
    const links = settingsLinks(['settings.view']);
    expect(links).toEqual(screens.filter((path) => path !== '/settings/system/directory'));
    expect(screen.queryByRole('link', { name: 'Directory (LDAP)' })).toBeNull();
  });

  it('gives identity.directory.manage the directory screen only', () => {
    expect(settingsLinks(['identity.directory.manage'])).toEqual(['/settings/system/directory']);
  });

  it('shows no settings section to a member without either code', () => {
    expect(settingsLinks([])).toEqual([]);
    expect(screen.queryByText('SETTINGS')).toBeNull();
  });
});
