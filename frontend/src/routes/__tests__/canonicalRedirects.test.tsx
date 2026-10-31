import React from 'react';
import { describe, it, expect } from 'vitest';
import { Navigate, Route } from 'react-router-dom';
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';
import { platformRoutes } from '@/modules/platform/routes/platformRoutes';
import { AppRoutes } from '@/routes/AppRoutes';

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

describe('canonical redirects (real route fragments)', () => {
  it('redirects /api-health to /platform/health', () => {
    const routes = collectRoutes((platformRoutes as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/api-health');
    expect(alias).toBeTruthy();
    expect(isNavigateTo(alias!.element, '/platform/health')).toBe(true);
  });

  it('redirects /workspace (the removed open-tabs screen, which could show no record) to the dashboard', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/workspace');
    expect(alias).toBeTruthy();
    expect(isNavigateTo(alias!.element, '/dashboard')).toBe(true);
  });

  it('redirects /calendar to /scheduling', () => {
    const tree = (AppRoutes as React.FC)({});
    const routes = collectRoutes((tree as React.ReactElement).props.children);
    const alias = routes.find((r) => r.path === '/calendar');
    expect(alias).toBeTruthy();
    expect(isNavigateTo(alias!.element, '/scheduling')).toBe(true);
  });
});
