/**
 * RoutePermissionGuard + registry tests (Phase 5, ADR-0033).
 *
 * The route guard is fail-closed:
 *   unauthenticated → /login
 *   registry entry denied → /forbidden
 *   registry entry allowed → children render
 * and the registry covers every protected AppRoutes path.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RoutePermissionGuard } from '@/routes/RoutePermissionGuard';
import { ROUTE_PERMISSIONS_REGISTRY, matchRouteMetadata } from '@/core/permissions/routePermissionsRegistry';
import { AppRoutes } from '@/routes/AppRoutes';
import type { User } from '@/types/identity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr-1',
    email: 'x@y.z',
    role: 'Artist',
    first_name: 'A',
    last_name: 'B',
    full_name: 'A B',
    name: 'A B',
    permissions: [],
    is_active: true,
    is_superuser: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as User;
}

// Shot crew member: holds the shot grants directly (project membership is
// enforced separately by ProjectRoute; the registry guard checks page codes).
const shotMember = makeUser({
  permissions: ['page.project.shots', 'shot.view'],
});

let currentUser: { user: User | null; isAuthenticated: boolean; isLoading: boolean } = {
  user: shotMember,
  isAuthenticated: true,
  isLoading: false,
};

vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => currentUser,
}));

function renderGuarded(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoutePermissionGuard />}>
          <Route path={path} element={<div data-testid="protected">OK</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
        <Route path="/forbidden" element={<div data-testid="forbidden">403</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoutePermissionGuard (fail-closed, ADR-0033)', () => {
  beforeEach(() => {
    currentUser = { user: shotMember, isAuthenticated: true, isLoading: false };
  });

  it('redirects unauthenticated users to /login', () => {
    currentUser = { user: null, isAuthenticated: false, isLoading: false };
    renderGuarded('/shots');
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('denies access when the user lacks the page permission', () => {
    // shotMember (Artist) lacks platform page code
    renderGuarded('/platform/admin');
    expect(screen.getByTestId('forbidden')).toBeInTheDocument();
  });

  it('denies access when a registered route grants are missing', () => {
    // shotMember has shot grants but NOT publishing/deliveries
    renderGuarded('/deliveries');
    expect(screen.getByTestId('forbidden')).toBeInTheDocument();
  });

  it('allows access when the user holds the route permission', () => {
    renderGuarded('/shots');
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('applies the superuser break-glass without registry grants', () => {
    currentUser = {
      user: makeUser({ is_superuser: true, role: 'Platform Admin' }),
      isAuthenticated: true,
      isLoading: false,
    };
    renderGuarded('/platform/admin');
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('denies production scope pages without project membership (D1)', () => {
    // shotMember lacks project membership for proj-xyz
    renderGuarded('/projects/proj-xyz');
    expect(screen.getByTestId('forbidden')).toBeInTheDocument();
  });
});

describe('route registry coverage (Phase 5)', () => {
  it('every protected AppRoutes path is matched by the registry', () => {
    const tree = (AppRoutes as React.FC)({});

    const paths = new Set<string>();
    const collect = (node: React.ReactNode) => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as { path?: string; children?: React.ReactNode; index?: boolean };
        if (child.type === Route && props.path) paths.add(props.path);
        if (props.children) collect(props.children);
      });
    };
    collect((tree as React.ReactElement).props.children);

    const PUBLIC = new Set(['/login', '/forgot-password', '/unauthorized', '/forbidden', '/error', '*', '/', '/calendar']);
    // '/calendar' redirects to '/scheduling' (registry-covered) before guard runs.
    // '/auth/change-password' is authentication-only by design: a forced
    // password change must be reachable before any permission-bearing surface,
    // so it renders outside RoutePermissionGuard and has no RBAC metadata.
    PUBLIC.add('/auth/change-password');

    const sample = (path: string) =>
      path
        .replace(':projectId', 'proj-001')
        .replace(':showId', 'show-1')
        .replace(':shotId', 'shot-1')
        .replace(':assetId', 'asset-1')
        .replace(':taskId', 'task-1')
        .replace(':versionId', 'ver-1')
        .replace(':membershipId', 'mem-1')
        .replace(':tab', 'overview')
        .replace(':section', 'roles')
        .replace(':id', 'ent-1');

    const missing = [...paths].filter(
      (p) => !PUBLIC.has(p) && !matchRouteMetadata(sample(p))
    );
    expect(missing).toEqual([]);
  });

  it('registry entries declare enforceable permissions', () => {
    // Every registry entry must name a page permission or explicit codes
    // (the guard is fail-closed: an entry with neither is meaningless).
    const offenders = Object.values(ROUTE_PERMISSIONS_REGISTRY).filter(
      (meta) => !meta.pagePermission && !(meta.permissions && meta.permissions.length > 0)
    );
    expect(offenders).toEqual([]);
  });
});
