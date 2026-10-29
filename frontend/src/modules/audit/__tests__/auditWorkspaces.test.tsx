import React from 'react';
import { describe, it, expect } from 'vitest';
import { Navigate, Route } from 'react-router-dom';
import { auditRoutes, TabRedirect } from '@/modules/audit/routes/auditRoutes';

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

function isRedirectTo(element: React.ReactNode, to: string, tab: string): boolean {
  if (!React.isValidElement(element)) return false;
  if (element.type === Navigate) {
    return (element.props as { to?: string }).to === to;
  }
  if (element.type === TabRedirect) {
    const props = element.props as { to?: string; tab?: string };
    return props.to === to && props.tab === tab;
  }
  return false;
}

describe('audit workspace routing', () => {
  it('has canonical /audit workspace (not a bare redirect)', () => {
    const routes = collectRoutes((auditRoutes as React.ReactElement).props.children);
    const canonical = routes.find((r) => r.path === '/audit');
    expect(canonical).toBeTruthy();
    expect(React.isValidElement(canonical!.element) && (canonical!.element as React.ReactElement).type === Navigate).toBe(false);
  });

  it('has canonical /system-logs workspace', () => {
    const routes = collectRoutes((auditRoutes as React.ReactElement).props.children);
    expect(routes.find((r) => r.path === '/system-logs')).toBeTruthy();
  });

  it('has canonical /jobs workspace', () => {
    const routes = collectRoutes((auditRoutes as React.ReactElement).props.children);
    expect(routes.find((r) => r.path === '/jobs')).toBeTruthy();
  });

  it('legacy aliases redirect with tab preserved', () => {
    const routes = collectRoutes((auditRoutes as React.ReactElement).props.children);
    const cases: [string, string, string][] = [
      ['/audit-logs', '/audit', 'audit-logs'],
      ['/activity', '/audit', 'activity'],
      ['/activities', '/audit', 'activity'],
      ['/api-requests', '/system-logs', 'api-requests'],
      ['/error-logs', '/system-logs', 'error-logs'],
      ['/change-logs', '/system-logs', 'change-logs'],
      ['/login-history', '/system-logs', 'login-history'],
      ['/background-jobs', '/jobs', 'background-jobs'],
      ['/tracks', '/jobs', 'tracks'],
    ];
    for (const [legacy, to, tab] of cases) {
      const route = routes.find((r) => r.path === legacy);
      expect(route, legacy).toBeTruthy();
      expect(isRedirectTo(route!.element, to, tab), legacy).toBe(true);
    }
  });
});
