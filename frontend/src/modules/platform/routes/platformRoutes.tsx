import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import { PermissionRoute } from '@/routes/PermissionRoute';
;
;
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';
import { lazyNamed } from '@/routes/lazyNamed';

// Loaded on first use, one chunk each (see lazyNamed).
const PlatformAdminPage = lazyNamed(() => import('@/modules/platform/pages/PlatformAdminPage'), 'PlatformAdminPage');
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

/** The old master-data tabs (`/platform/master-data/:tab`, `/platform/admin/:tab`) now live under /platform/catalog. */
const MasterDataRedirect: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const kind = tab ? CATALOG_TABS[tab] : undefined;
  return <Navigate to={kind ? `/platform/catalog/${kind}` : '/platform/catalog'} replace />;
};

/**
 * The master-data tabs of the legacy Platform Admin page read `is_archived` (the API sends
 * `status`), so they are served by the catalog admin instead; the other tabs (roles/org structure,
 * pipeline, theme, layout, DB schema) stay on that page until Phase 11.
 */
const AdminTabGate: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const kind = tab ? CATALOG_TABS[tab] : undefined;
  return kind ? <Navigate to={`/platform/catalog/${kind}`} replace /> : <PlatformAdminPage />;
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
      <Route path="/platform/admin" element={<PlatformAdminPage />} />
      <Route path="/platform/admin/:tab" element={<AdminTabGate />} />
      <Route path="/platform/master-data" element={<MasterDataRedirect />} />
      <Route path="/platform/master-data/:tab" element={<MasterDataRedirect />} />
    </Route>

  </>
);
