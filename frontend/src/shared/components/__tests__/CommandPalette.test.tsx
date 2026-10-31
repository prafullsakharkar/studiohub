/**
 * Task 6: command palette must offer only accessible targets —
 * admin-only entries hidden without a grant, permission-denied commands
 * filtered, and no client-side "Recent Activity" feed (the audit hub is the real one).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const state = {
  user: null as any,
};

vi.mock('@/providers/ThemeProvider', () => ({
  useThemeMode: () => ({ mode: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: state.user }),
}));

vi.mock('@/core/permissions/usePermissions', () => ({
  usePermissions: () => ({
    currentRole: state.user?.role ? { id: state.user.role, name: state.user.role } : null,
    hasPermission: () => true,
    can: () => true,
  }),
}));

const SUPERUSER = {
  id: 'u-admin',
  email: 'admin@studiohub.vfx',
  is_superuser: true,
  is_active: true,
  role: 'Artist',
  permissions: [] as string[],
  memberships: [] as any[],
};

const PLAIN_MEMBER = {
  id: 'u-plain',
  email: 'artist@studiohub.vfx',
  is_superuser: false,
  is_active: true,
  role: 'Artist',
  permissions: [] as string[],
  memberships: [] as any[],
};

async function renderPalette() {
  const { CommandPalette } = await import('../CommandPalette');
  const view = render(
    <MemoryRouter>
      <CommandPalette isOpen onClose={() => undefined} />
    </MemoryRouter>
  );
  return { view, CommandPalette };
}

describe('CommandPalette access scoping', () => {
  beforeEach(() => {
    state.user = PLAIN_MEMBER;
  });

  it('hides admin-only entries from users without an admin grant', async () => {
    await renderPalette();
    expect(screen.queryByText('Access & RBAC Workspace')).toBeNull();
    expect(screen.queryByText('Database Inspector & Storage')).toBeNull();
  });

  it('shows admin-only entries to a superuser', async () => {
    state.user = SUPERUSER;
    await renderPalette();
    fireEvent.click(screen.getByText(/Commands \(/));
    expect(screen.getByText('Access & RBAC Workspace')).toBeTruthy();
    // The in-app QA runner was removed (docs/sync Phase 1): no one is offered it any more.
    expect(screen.queryByText('Open API Diagnostic & Test Suite')).toBeNull();
  });

  it('refreshes admin entries when the active user changes (no stale closure)', async () => {
    const { view, CommandPalette } = await renderPalette();
    fireEvent.click(screen.getByText(/Commands \(/));
    expect(screen.queryByText('Access & RBAC Workspace')).toBeNull();
    state.user = SUPERUSER;
    view.rerender(
      <MemoryRouter>
        <CommandPalette isOpen onClose={() => undefined} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/Commands \(/));
    expect(screen.getByText('Access & RBAC Workspace')).toBeTruthy();
  });

  it('has no Recent Activity tab: the real feed is the audit hub, offered as a command', async () => {
    state.user = SUPERUSER;
    await renderPalette();
    expect(screen.queryByText('Recent Activity')).toBeNull();
    fireEvent.click(screen.getByText(/Commands \(/));
    expect(screen.getByText('Open Activity & Audit Hub')).toBeTruthy();
  });
});
