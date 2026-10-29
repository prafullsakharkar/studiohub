import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import { PermissionRoute } from '@/routes/PermissionRoute';
;
;
import { PlatformAdminPage } from '@/modules/platform/pages/PlatformAdminPage';
import { ApiHealthPage } from '@/modules/platform/pages/ApiHealthPage';
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';

const MasterDataRedirect: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  return <Navigate to={tab ? `/platform/admin/${tab}` : '/platform/admin'} replace />;
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
    <Route path="/api-health" element={<PreserveQueryRedirect to="/platform/health" />} />

    <Route element={<PermissionRoute permissions={['platform.admin.view', 'platform.master_data.view', 'platform.software.view', 'platform.status.view', 'settings.view', 'page.settings']} requireAny={true} />}>
      <Route path="/platform/admin" element={<PlatformAdminPage />} />
      <Route path="/platform/admin/:tab" element={<PlatformAdminPage />} />
      <Route path="/platform/master-data" element={<MasterDataRedirect />} />
      <Route path="/platform/master-data/:tab" element={<MasterDataRedirect />} />
    </Route>

  </>
);
