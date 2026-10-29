import { platformRoutes } from '@/modules/platform';

import { DashboardPage } from '@/modules/dashboard';

import { DeliveriesPage, DeliveryWorkspacePage } from '@/modules/deliveries';

import { DepartmentsListPage, DepartmentWorkspacePage, CreateDepartmentPage, EditDepartmentPage } from '@/modules/departments';

import { OfficesListPage, OfficeWorkspacePage, CreateOfficePage, EditOfficePage } from '@/modules/offices';

import { PeopleListPage, PersonWorkspacePage, CreatePersonPage, EditPersonPage } from '@/modules/people';

import { ClientsPage, ClientCreatePage, ClientWorkspacePage } from '@/modules/clients';

import { VendorsPage, VendorCreatePage, VendorWorkspacePage } from '@/modules/vendors';

import { PublishingPage } from '@/modules/publishing';

import { SchedulingPage } from '@/modules/scheduling';

import { TeamsListPage, TeamWorkspacePage, CreateTeamPage, EditTeamPage } from '@/modules/teams';

import { WorkspacePage } from '@/modules/workspace';
import { AccessWorkspacePage } from '@/modules/access';
import { PreserveQueryRedirect } from './PreserveQueryRedirect';

import { WorkflowsPage } from '@/modules/workflows';

import { ReviewsPage } from '@/modules/reviews';

import { auditRoutes } from '@/modules/audit';

import { AssetsPage, AssetWorkspacePage } from '@/modules/assets';

import { VersionsListPage, VersionWorkspacePage } from '@/modules/versions';

import { ShotsPage, ShotWorkspacePage } from '@/modules/shots';

import { TasksPage, TaskDetailPage, TimelogsPage } from '@/modules/tasks';

import { ProjectsPage, ProjectWorkspacePage, ProjectFormPage } from '@/modules/production';

import { LoginPage, ForgotPasswordPage, ChangePasswordPage } from '@/modules/auth';

import React from 'react';

import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthenticatedRoute } from './AuthenticatedRoute';

import { ProtectedRoute } from './ProtectedRoute';

import { ProjectRoute } from './ProjectRoute';

import { PermissionRoute } from './PermissionRoute';

import { RoutePermissionGuard } from './RoutePermissionGuard';

import { GuestRoute } from './GuestRoute';

import { AppLayout } from '@/layouts/AppLayout';

import { NotFoundPage } from '@/pages/NotFoundPage';

import { ForbiddenPage } from '@/pages/ForbiddenPage';

import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

import { ServerErrorPage } from '@/pages/ServerErrorPage';

import { TestingPage } from '@/pages/TestingPage';

export const AppRoutes: React.FC = () => {

  return (

    <Routes>

      {/* Guest Only Routes */}

      <Route element={<GuestRoute />}>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      </Route>

      {/* Authenticated Studio App Routes */}

      <Route element={<AuthenticatedRoute />}>

        {/* Forced credential rotation: rendered outside AppLayout so no other
            authenticated content is reachable while the flag is set. */}

        <Route path="/auth/change-password" element={<ChangePasswordPage />} />

        <Route element={<RoutePermissionGuard><AppLayout /></RoutePermissionGuard>}>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* HOME & WORKSPACE */}

          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/workspace" element={<WorkspacePage />} />

          {/* PEOPLE */}

          <Route path="/people" element={<PeopleListPage />} />

          <Route path="/people/new" element={<CreatePersonPage />} />

          <Route element={<PermissionRoute permissions={['people.view']} />}>

            <Route path="/people/:id" element={<PersonWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['people.update']} />}>

            <Route path="/people/:id/edit" element={<EditPersonPage />} />

          </Route>

          {/* DEPARTMENTS */}

          <Route path="/departments" element={<DepartmentsListPage />} />

          <Route path="/departments/new" element={<CreateDepartmentPage />} />

          <Route element={<PermissionRoute permissions={['department.view']} />}>

            <Route path="/departments/:id" element={<DepartmentWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['department.update']} />}>

            <Route path="/departments/:id/edit" element={<EditDepartmentPage />} />

          </Route>

          {/* TEAMS */}

          <Route path="/teams" element={<TeamsListPage />} />

          <Route path="/teams/new" element={<CreateTeamPage />} />

          <Route element={<PermissionRoute permissions={['team.view']} />}>

            <Route path="/teams/:id" element={<TeamWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['team.update']} />}>

            <Route path="/teams/:id/edit" element={<EditTeamPage />} />

          </Route>

          {/* OFFICES */}

          <Route path="/offices" element={<OfficesListPage />} />

          <Route path="/offices/new" element={<CreateOfficePage />} />

          <Route element={<PermissionRoute permissions={['office.view']} />}>

            <Route path="/offices/:id" element={<OfficeWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['office.update']} />}>

            <Route path="/offices/:id/edit" element={<EditOfficePage />} />

          </Route>

          {/* CLIENTS & VENDORS */}

          <Route path="/clients" element={<ClientsPage />} />

          <Route element={<PermissionRoute permissions={['client.create']} />}>

            <Route path="/clients/new" element={<ClientCreatePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['client.view']} />}>

            <Route path="/clients/:id" element={<ClientWorkspacePage />} />

          </Route>

          <Route path="/vendors" element={<VendorsPage />} />

          <Route element={<PermissionRoute permissions={['vendor.create']} />}>

            <Route path="/vendors/new" element={<VendorCreatePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['vendor.view']} />}>

            <Route path="/vendors/:id" element={<VendorWorkspacePage />} />

          </Route>

          {/* PRODUCTION APPS */}

          <Route element={<ProjectRoute />}>

            <Route path="/shows/:showId" element={<ProjectWorkspacePage />} />

            <Route path="/projects/:id" element={<ProjectWorkspacePage />} />

            <Route path="/projects/:id/:tab" element={<ProjectWorkspacePage />} />

            <Route path="/projects/:id/assets" element={<ProjectWorkspacePage />} />

          </Route>

          <Route path="/projects" element={<ProjectsPage />} />

          <Route element={<PermissionRoute permissions={['project.create']} />}>

            <Route path="/projects/new" element={<ProjectFormPage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['project.update']} />}>

            <Route path="/projects/:id/edit" element={<ProjectFormPage />} />

          </Route>

          <Route path="/shots" element={<ShotsPage />} />

          <Route path="/shots/:shotId" element={<ShotWorkspacePage />} />

          <Route path="/shots/:shotId/:tab" element={<ShotWorkspacePage />} />

          <Route path="/projects/:projectId/shots/:shotId" element={<ShotWorkspacePage />} />

          <Route path="/projects/:projectId/shots/:shotId/:tab" element={<ShotWorkspacePage />} />

          <Route path="/assets" element={<AssetsPage />} />

          <Route path="/assets/:assetId" element={<AssetWorkspacePage />} />

          <Route path="/assets/:assetId/:tab" element={<AssetWorkspacePage />} />

          <Route path="/projects/:projectId/assets/:assetId" element={<AssetWorkspacePage />} />

          <Route path="/projects/:projectId/assets/:assetId/:tab" element={<AssetWorkspacePage />} />

          <Route path="/tasks" element={<TasksPage />} />

          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />

          <Route path="/timelogs" element={<TimelogsPage />} />

          <Route path="/versions" element={<VersionsListPage />} />

          <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />

          <Route path="/publishing" element={<PublishingPage />} />

          <Route path="/deliveries" element={<DeliveriesPage />} />

          <Route path="/deliveries/:id" element={<DeliveryWorkspacePage />} />

          <Route path="/reviews" element={<ReviewsPage />} />

          <Route path="/workflows" element={<WorkflowsPage />} />

          <Route path="/scheduling" element={<SchedulingPage />} />

          <Route path="/calendar" element={<PreserveQueryRedirect to="/scheduling" />} />

          {/* PLATFORM APPS */}

          {platformRoutes}

          <Route path="/settings" element={<PreserveQueryRedirect to="/platform/admin/pipeline" />} />

          {/* Access & RBAC workspace — the org-free RBAC surface (Task 12
              sections) is reachable at /access[/:section]; /permissions and
              /settings/permissions are legacy aliases into it. */}
          <Route element={<PermissionRoute permissions={['roles.view', 'security.view']} requireAny={true} />}>

            <Route path="/settings/permissions" element={<PreserveQueryRedirect to="/access" />} />

            <Route path="/permissions" element={<PreserveQueryRedirect to="/access" />} />

            <Route path="/access" element={<AccessWorkspacePage />} />

            <Route path="/access/:section" element={<AccessWorkspacePage />} />

          </Route>

          {auditRoutes}

          <Route element={<PermissionRoute requireAdmin={true} pagePermission="page.testing" permissions={['testing.view']} requireAny={true} fallbackPath="/forbidden" />}>

            <Route path="/testing" element={<TestingPage />} />

          </Route>

        </Route>

      </Route>

      {/* Error & Fallback Routes */}

      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route path="/error" element={<ServerErrorPage />} />

      <Route path="*" element={<NotFoundPage />} />

    </Routes>

  );

};
