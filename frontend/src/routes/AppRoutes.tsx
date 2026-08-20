import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';

// Auth Pages
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage';

// Main Application Module Pages
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage';
import { WorkspacePage } from '@/modules/workspace/pages/WorkspacePage';
import { ProjectsPage } from '@/modules/production/pages/ProjectsPage';
import { ProjectDetailPage } from '@/modules/production/pages/ProjectDetailPage';
import { ShotsPage } from '@/modules/shots/pages/ShotsPage';
import { AssetsPage } from '@/modules/assets/pages/AssetsPage';
import { TasksPage } from '@/modules/tasks/pages/TasksPage';
import { ReviewsPage } from '@/modules/reviews/pages/ReviewsPage';
import { AuditLogsPage } from '@/modules/audit/pages/AuditLogsPage';
import { SettingsPage } from '@/modules/settings/pages/SettingsPage';

// Foundation & Organization Pages
import { OrganizationsPage } from '@/modules/organization/pages/OrganizationsPage';
import { CreateOrganizationPage } from '@/modules/organization/pages/CreateOrganizationPage';
import { OrganizationWorkspacePage } from '@/modules/organization/pages/OrganizationWorkspacePage';
import { EditOrganizationPage } from '@/modules/organization/pages/EditOrganizationPage';
import { ClientsPage } from '@/modules/organization/pages/ClientsPage';
import { VendorsPage } from '@/modules/organization/pages/VendorsPage';
import { PeoplePage } from '@/modules/organization/pages/PeoplePage';
import { DepartmentsPage } from '@/modules/organization/pages/DepartmentsPage';
import { TeamsPage } from '@/modules/organization/pages/TeamsPage';
import { OfficesPage } from '@/modules/organization/pages/OfficesPage';

// People Module Pages
import { PersonWorkspacePage } from '@/modules/people/pages/PersonWorkspacePage';
import { CreatePersonPage } from '@/modules/people/pages/CreatePersonPage';
import { EditPersonPage } from '@/modules/people/pages/EditPersonPage';

// Departments Module Pages
import { DepartmentWorkspacePage } from '@/modules/departments/pages/DepartmentWorkspacePage';
import { CreateDepartmentPage } from '@/modules/departments/pages/CreateDepartmentPage';
import { EditDepartmentPage } from '@/modules/departments/pages/EditDepartmentPage';

// Teams Module Pages
import { TeamWorkspacePage } from '@/modules/teams/pages/TeamWorkspacePage';
import { CreateTeamPage } from '@/modules/teams/pages/CreateTeamPage';
import { EditTeamPage } from '@/modules/teams/pages/EditTeamPage';

// Offices Module Pages
import { OfficeWorkspacePage } from '@/modules/offices/pages/OfficeWorkspacePage';
import { CreateOfficePage } from '@/modules/offices/pages/CreateOfficePage';
import { EditOfficePage } from '@/modules/offices/pages/EditOfficePage';

// Production & Platform Pages
import { VersionsPage } from '@/modules/production/pages/VersionsPage';
import { NotificationsPage } from '@/modules/platform/pages/NotificationsPage';
import { BillingPage } from '@/modules/platform/pages/BillingPage';
import { ReportsPage } from '@/modules/platform/pages/ReportsPage';

// System Pages
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { ServerErrorPage } from '@/pages/ServerErrorPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Guest Only Routes */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Route>

      {/* Protected Studio App Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* HOME & WORKSPACE */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />

          {/* ORGANIZATION FOUNDATION APPS */}
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/new" element={<CreateOrganizationPage />} />
          <Route path="/organizations/:id" element={<OrganizationWorkspacePage />} />
          <Route path="/organizations/:id/edit" element={<EditOrganizationPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/new" element={<CreatePersonPage />} />
          <Route path="/people/:id" element={<PersonWorkspacePage />} />
          <Route path="/people/:id/edit" element={<EditPersonPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/departments/new" element={<CreateDepartmentPage />} />
          <Route path="/departments/:id" element={<DepartmentWorkspacePage />} />
          <Route path="/departments/:id/edit" element={<EditDepartmentPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/new" element={<CreateTeamPage />} />
          <Route path="/teams/:id" element={<TeamWorkspacePage />} />
          <Route path="/teams/:id/edit" element={<EditTeamPage />} />
          <Route path="/offices" element={<OfficesPage />} />
          <Route path="/offices/new" element={<CreateOfficePage />} />
          <Route path="/offices/:id" element={<OfficeWorkspacePage />} />
          <Route path="/offices/:id/edit" element={<EditOfficePage />} />

          {/* PRODUCTION APPS */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/shots" element={<ShotsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/versions" element={<VersionsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />

          {/* PLATFORM APPS */}
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/analytics" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
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
