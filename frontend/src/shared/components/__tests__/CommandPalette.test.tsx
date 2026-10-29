/**
 * Task 6: command palette must offer only accessible targets —
 * admin-only entries hidden without a grant, permission-denied commands
 * filtered, and Recent Activity surfaced platform-wide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

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

function activityFixture(id: string, label: string) {
  return {
    id,
    action: 'update',
    actionLabel: label,
    description: `${label} happened`,
    entity: { type: 'project', id: 'proj-1', name: 'One', code: 'P1' },
    actor: { id: 'u-1', name: 'Someone' },
    timestamp: new Date().toISOString(),
  };
}

async function renderPalette() {
  const { CommandPalette } = await import('../CommandPalette');
  const { useActivityStore } = await import('@/shared/stores/useActivityStore');
  useActivityStore.setState({ activities: [] as any });
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
    expect(screen.queryByText('Open API Diagnostic & Test Suite')).toBeNull();
    expect(screen.queryByText('Database Inspector & Storage')).toBeNull();
  });

  it('shows admin-only entries to a superuser', async () => {
    state.user = SUPERUSER;
    await renderPalette();
    fireEvent.click(screen.getByText(/Commands \(/));
    expect(screen.getByText('Access & RBAC Workspace')).toBeTruthy();
    expect(screen.getByText('Open API Diagnostic & Test Suite')).toBeTruthy();
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

  it('surfaces Recent Activity across the platform (not org-scoped)', async () => {
    await renderPalette();
    const { useActivityStore } = await import('@/shared/stores/useActivityStore');
    useActivityStore.setState({
      activities: [
        activityFixture('act-a', 'Apex deploy'),
        activityFixture('act-b', 'Nova deploy'),
      ] as any,
    });
    fireEvent.click(screen.getByText('Recent Activity'));
    expect(screen.getByText('Apex deploy')).toBeTruthy();
    expect(screen.getByText('Nova deploy')).toBeTruthy();
  });
});
