import React from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { PermissionRoute } from '@/routes/PermissionRoute';
import { lazyNamed } from '@/routes/lazyNamed';

// Loaded on first use, one chunk each (see lazyNamed).
const AuditWorkspacePage = lazyNamed(() => import('@/modules/audit/pages/AuditWorkspacePage'), 'AuditWorkspacePage');
const SystemLogsWorkspacePage = lazyNamed(() => import('@/modules/audit/pages/SystemLogsWorkspacePage'), 'SystemLogsWorkspacePage');
const JobsWorkspacePage = lazyNamed(() => import('@/modules/audit/pages/JobsWorkspacePage'), 'JobsWorkspacePage');

export const auditRoutePaths = [
  'audit',
  'system-logs',
  'jobs',
  // Legacy paths (redirect, tab preserved via ?tab=)
  'audit-logs',
  'activity',
  'activities',
  'api-requests',
  'background-jobs',
  'change-logs',
  'error-logs',
  'login-history',
  'tracks',
];

/** Redirect to a workspace tab while preserving all other search params. */
export const TabRedirect: React.FC<{ to: string; tab: string }> = ({ to, tab }) => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (!params.get('tab')) params.set('tab', tab);
  const qs = params.toString();
  return <Navigate to={qs ? `${to}?${qs}` : to} replace />;
};

/**
 * Audit route fragment (NOT a wrapper component: React Router v6 only
 * flattens Fragment children of <Routes>). Embed as {auditRoutes} at the
 * same nesting level the block lived at in AppRoutes.
 */
export const auditRoutes = (
  <>
    <Route element={<PermissionRoute permissions={['audit.view', 'page.audit_logs', 'activity.view', 'activities.view', 'page.activities']} requireAny={true} />}>
      <Route path="/audit" element={<AuditWorkspacePage />} />
    </Route>

    <Route element={<PermissionRoute permissions={['api_requests.view', 'page.api_requests', 'error_logs.view', 'page.error_logs', 'change_logs.view', 'page.change_logs', 'login_history.view', 'page.login_history']} requireAny={true} />}>
      <Route path="/system-logs" element={<SystemLogsWorkspacePage />} />
    </Route>

    <Route element={<PermissionRoute permissions={['background_jobs.view', 'page.background_jobs', 'tracks.view', 'page.tracks']} requireAny={true} />}>
      <Route path="/jobs" element={<JobsWorkspacePage />} />
    </Route>

    {/* Legacy: Audit & Activity */}
    <Route element={<PermissionRoute permissions={['audit.view', 'page.audit_logs']} requireAny={true} />}>
      <Route path="/audit-logs" element={<TabRedirect to="/audit" tab="audit-logs" />} />
    </Route>

    <Route element={<PermissionRoute permissions={['activity.view', 'activities.view', 'page.activities']} requireAny={true} />}>
      <Route path="/activity" element={<TabRedirect to="/audit" tab="activity" />} />
      <Route path="/activities" element={<TabRedirect to="/audit" tab="activity" />} />
    </Route>

    {/* Legacy: System Logs */}
    <Route element={<PermissionRoute permissions={['api_requests.view', 'page.api_requests']} requireAny={true} />}>
      <Route path="/api-requests" element={<TabRedirect to="/system-logs" tab="api-requests" />} />
    </Route>

    <Route element={<PermissionRoute permissions={['change_logs.view', 'page.change_logs']} requireAny={true} />}>
      <Route path="/change-logs" element={<TabRedirect to="/system-logs" tab="change-logs" />} />
    </Route>

    <Route element={<PermissionRoute permissions={['error_logs.view', 'page.error_logs']} requireAny={true} />}>
      <Route path="/error-logs" element={<TabRedirect to="/system-logs" tab="error-logs" />} />
    </Route>

    <Route element={<PermissionRoute permissions={['login_history.view', 'page.login_history']} requireAny={true} />}>
      <Route path="/login-history" element={<TabRedirect to="/system-logs" tab="login-history" />} />
    </Route>

    {/* Legacy: Jobs & Tracks */}
    <Route element={<PermissionRoute permissions={['background_jobs.view', 'page.background_jobs']} requireAny={true} />}>
      <Route path="/background-jobs" element={<TabRedirect to="/jobs" tab="background-jobs" />} />
    </Route>

    <Route element={<PermissionRoute permissions={['tracks.view', 'page.tracks']} requireAny={true} />}>
      <Route path="/tracks" element={<TabRedirect to="/jobs" tab="tracks" />} />
    </Route>
  </>
);
