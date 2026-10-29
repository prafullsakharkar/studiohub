import React from 'react';
import { describe, it, expect } from 'vitest';
import { Navigate, Route } from 'react-router-dom';
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';
import { AppRoutes } from '@/routes/AppRoutes';
import { AccessWorkspacePage } from '@/modules/access';

function collectRoutes(node: React.ReactNode, out: { path?: string; element?: React.ReactNode }[] = []) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === Route) {
      out.push({ path: (child.props as { path?: string }).path, element: (child.props as { element?: React.ReactNode }).element });
    }
    const kids = (child.props as { children?: React.ReactNode }).children;
    if (kids) collectRoutes(kids, out);
  });
  return out;
}

function isNavigateTo(element: React.ReactNode, to: string): boolean {
  if (!React.isValidElement(element)) return false;
  if ((element.props as { to?: string }).to !== to) return false;
  return element.type === Navigate || element.type === PreserveQueryRedirect;
}

function rendersWorkspace(element: React.ReactNode): boolean {
  if (!React.isValidElement(element)) return false;
  return element.type === AccessWorkspacePage;
}

const ACCESS_TABS = [
  { id: 'overview', permission: 'security.view' },
  { id: 'users', permission: 'people.view' },
  { id: 'roles', permission: 'roles.view' },
  { id: 'groups', permission: 'group.view' },
  { id: 'permissions', permission: 'security.view' },
  { id: 'projects', permission: 'project.view' },
  { id: 'simulator', permission: 'permissions.manage' },
  { id: 'audit', permission: 'audit.view' },
];

function visibleTabs(granted: string[]) {
  return ACCESS_TABS.filter((t) => granted.includes(t.permission)).map((t) => t.id);
}

describe('rbac single canonical entry', () => {
  it('renders the org-free workspace at /access', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/access');
    expect(alias).toBeTruthy();
    expect(rendersWorkspace(alias!.element)).toBe(true);
  });

  it('renders the org-free workspace at /access/:section (legacy links preserved)', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/access/:section');
    expect(alias).toBeTruthy();
    expect(rendersWorkspace(alias!.element)).toBe(true);
  });

  it('redirects /permissions to the access workspace', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/permissions');
    expect(alias).toBeTruthy();
    expect(isNavigateTo(alias!.element, '/access')).toBe(true);
  });

  it('redirects /settings/permissions to the access workspace', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/settings/permissions');
    expect(alias).toBeTruthy();
    expect(isNavigateTo(alias!.element, '/access')).toBe(true);
  });

  it('hides simulator without permissions.manage', () => {
    expect(visibleTabs(['roles.view', 'security.view'])).not.toContain('simulator');
  });
});
