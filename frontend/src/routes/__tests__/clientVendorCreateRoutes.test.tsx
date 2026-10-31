import React from 'react';
import { describe, it, expect } from 'vitest';
import { Route } from 'react-router-dom';
import { AppRoutes } from '@/routes/AppRoutes';

/** The page a route mounts: pages load lazily, and `lazyNamed` gives each wrapper the name of its component. */
const pageOf = (route: { element?: React.ReactNode } | undefined) =>
  ((route?.element as React.ReactElement | undefined)?.type as { displayName?: string } | undefined)?.displayName;

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

describe('client/vendor create routes (Task 12 fix)', () => {
  it('/clients/new maps to ClientCreatePage, never the :id workspace', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const createRoute = routes.find((r) => r.path === '/clients/new');
    const detailRoute = routes.find((r) => r.path === '/clients/:id');
    expect(createRoute).toBeTruthy();
    expect(pageOf(createRoute)).toBe('ClientCreatePage');
    expect(pageOf(detailRoute)).toBe('ClientWorkspacePage');
  });

  it('/vendors/new maps to VendorCreatePage, never the :id workspace', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const createRoute = routes.find((r) => r.path === '/vendors/new');
    const detailRoute = routes.find((r) => r.path === '/vendors/:id');
    expect(createRoute).toBeTruthy();
    expect(pageOf(createRoute)).toBe('VendorCreatePage');
    expect(pageOf(detailRoute)).toBe('VendorWorkspacePage');
  });
});
