/**
 * Task 6: header option gating — admin entries (Pipeline Settings, Theme
 * editor, API health HUD) require superuser or an explicit grant. A
 * `Platform Admin` role label alone grants nothing (strict superuser rule,
 * spec §1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const headerQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={headerQueryClient}>{ui}</QueryClientProvider>
);

const state = {
  user: null as any,
  grants: [] as string[],
};

vi.mock('@/modules/auth', () => ({
  useAuth: () => ({
    user: state.user,
    can: (p: string) => state.grants.includes(p),
    logout: vi.fn(),
  }),
}));

vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: state.user }),
}));

vi.mock('@/providers/ThemeProvider', () => ({
  useThemeMode: () => ({ mode: 'dark', resolvedMode: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('@/shared/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => undefined,
}));

vi.mock('../ProjectSwitcher', () => ({
  ProjectSwitcher: () => <div data-testid="proj-switcher" />,
}));
vi.mock('@/shared/layouts/LayoutDensityControl', () => ({
  LayoutDensityControl: () => <div data-testid="density" />,
}));
vi.mock('@/shared/components/CommandPalette', () => ({
  CommandPalette: () => null,
}));
vi.mock('@/shared/components/KeyboardShortcutsModal', () => ({
  KeyboardShortcutsModal: () => null,
}));

async function renderHeader() {
  const { Header } = await import('../Header');
  const { useNotificationStore } = await import('@/shared/stores/useNotificationStore');
  useNotificationStore.setState({ notifications: [] });
  const { fireEvent } = await import('@testing-library/react');
  render(wrap(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  ));
  fireEvent.click(screen.getByLabelText('User account menu'));
}

describe('Header admin option gating', () => {
  beforeEach(() => {
    state.grants = [];
    state.user = {
      id: 'u-plain',
      email: 'artist@studiohub.vfx',
      full_name: ' plain artist',
      first_name: 'Plain',
      is_superuser: false,
      role: 'Artist',
    };
  });

  it('renders the static studio badge with no org-switching UI', async () => {
    await renderHeader();
    expect(screen.getByTestId('studio-badge')).toBeTruthy();
    expect(screen.queryByTestId('org-switcher')).toBeNull();
  });

  it('shows no admin entries to a user with no grants', async () => {
    await renderHeader();
    expect(screen.queryByText('Pipeline Settings')).toBeNull();
    expect(screen.queryByText('Theme & Accent Editor')).toBeNull();
  });

  it('does not treat the Platform Admin role label as a grant', async () => {
    state.user = { ...state.user, role: 'Platform Admin' };
    await renderHeader();
    expect(screen.queryByText('Pipeline Settings')).toBeNull();
    expect(screen.queryByText('Theme & Accent Editor')).toBeNull();
  });

  it('shows settings entries to a superuser', async () => {
    state.user = { ...state.user, is_superuser: true };
    await renderHeader();
    expect(screen.getByText('Pipeline Settings')).toBeTruthy();
    expect(screen.getByText('Theme & Accent Editor')).toBeTruthy();
  });

  it('shows settings entries with an explicit settings grant', async () => {
    state.grants = ['settings.view'];
    await renderHeader();
    expect(screen.getByText('Pipeline Settings')).toBeTruthy();
    expect(screen.getByText('Theme & Accent Editor')).toBeTruthy();
  });

  it('hides the API health HUD link without the platform grant', async () => {
    const { container } = await (async () => {
      const { Header } = await import('../Header');
      const r = render(wrap(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      ));
      return { container: r.container };
    })();
    expect(container.querySelector('a[href="/platform/health"]')).toBeNull();
  });

  it('shows the API health HUD link with the platform grant', async () => {
    state.grants = ['platform.admin.view'];
    const { Header } = await import('../Header');
    const { container } = render(wrap(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    ));
    expect(container.querySelector('a[href="/platform/health"]')).not.toBeNull();
  });
});
