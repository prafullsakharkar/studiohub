import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import { PermissionRoute } from '@/routes/PermissionRoute';
;
;
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';
import { lazyNamed } from '@/routes/lazyNamed';

// Loaded on first use, one chunk each (see lazyNamed).
const ApiHealthPage = lazyNamed(() => import('@/modules/platform/pages/ApiHealthPage'), 'ApiHealthPage');
const CatalogAdminPage = lazyNamed(() => import('@/modules/catalog/CatalogAdminPage'), 'CatalogAdminPage');

const CATALOG_TABS: Record<string, string> = {
  software: 'software',
  statuses: 'statuses',
  'task-types': 'task-types',
  'asset-types': 'asset-types',
  'shot-types': 'shot-types',
  'review-types': 'review-types',
  'file-types': 'file-types',
  'asset-shot-types': 'asset-types',
  'review-file-types': 'review-types',
};

/**
 * Where each slug of the old Platform Administration page lives now. The page had a tab per catalog kind
 * (software, statuses, the types), one for roles and the org structure, and an overview; every one is a screen
 * of its own, so the old URLs only redirect. An unknown slug lands on the catalog.
 */
const ADMIN_PAGE_TARGETS: Record<string, string> = {
  roles: '/access/roles',
  groups: '/access/groups',
  departments: '/departments',
  positions: '/positions',
  'api-health': '/platform/health',
};

export function adminTabTarget(tab?: string): string {
  if (!tab) return '/platform/catalog';
  const kind = CATALOG_TABS[tab];
  if (kind) return `/platform/catalog/${kind}`;
  return ADMIN_PAGE_TARGETS[tab] ?? '/platform/catalog';
}

/** `/platform/admin[/:tab]` and `/platform/master-data[/:tab]`: sent to the screen that replaced the tab. */
const AdminRedirect: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  return <Navigate to={adminTabTarget(tab)} replace />;
};

/**
 * Platform route fragment (NOT a wrapper component: React Router v6 only
 * flattens Fragment children of <Routes>). Embed as {platformRoutes} at the
 * same nesting level the block lived at in AppRoutes.
 */
export const platformRoutes = (
  <>
    {/* PLATFORM APPS */}
    <Route path="/platform/health" element={<ApiHealthPage />} />
    <Route path="/platform/catalog" element={<CatalogAdminPage />} />
    <Route path="/platform/catalog/:kind" element={<CatalogAdminPage />} />
    <Route path="/api-health" element={<PreserveQueryRedirect to="/platform/health" />} />

    <Route element={<PermissionRoute permissions={['platform.admin.view', 'platform.master_data.view', 'platform.software.view', 'platform.status.view', 'settings.view', 'page.settings']} requireAny={true} />}>
      <Route path="/platform/admin" element={<AdminRedirect />} />
      <Route path="/platform/admin/:tab" element={<AdminRedirect />} />
      <Route path="/platform/master-data" element={<AdminRedirect />} />
      <Route path="/platform/master-data/:tab" element={<AdminRedirect />} />
    </Route>

  </>
);
