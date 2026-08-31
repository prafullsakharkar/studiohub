import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { AppLayout } from '@/layouts/AppLayout';

// Auth Pages
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage';

// Main Application Module Pages
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage';
import { WorkspacePage } from '@/modules/workspace/pages/WorkspacePage';
import { ProjectsPage } from '@/modules/production/pages/ProjectsPage';
import { ProjectWorkspacePage } from '@/modules/production/pages/ProjectWorkspacePage';
import { ProjectFormPage } from '@/modules/production/pages/ProjectFormPage';
import { ShotsPage } from '@/modules/shots/pages/ShotsPage';
import { AssetsPage } from '@/modules/assets/pages/AssetsPage';
import { AssetWorkspacePage } from '@/modules/assets/pages/AssetWorkspacePage';
import { TasksPage } from '@/modules/tasks/pages/TasksPage';
import { TaskDetailPage } from '@/modules/tasks/pages/TaskDetailPage';
import { TimelogsPage } from '@/modules/tasks/pages/TimelogsPage';
import { ReviewsPage } from '@/modules/reviews/pages/ReviewsPage';
import { AuditLogsPage } from '@/modules/audit/pages/AuditLogsPage';
import { SettingsPage } from '@/modules/settings/pages/SettingsPage';
import { UsersPage } from '@/modules/identity/pages/UsersPage';
import { RolesPage } from '@/modules/identity/pages/RolesPage';

// Foundation & Organization Pages
import { OrganizationsPage } from '@/modules/organization/pages/OrganizationsPage';
import { CreateOrganizationPage } from '@/modules/organization/pages/CreateOrganizationPage';
import { OrganizationWorkspacePage } from '@/modules/organization/pages/OrganizationWorkspacePage';
import { EditOrganizationPage } from '@/modules/organization/pages/EditOrganizationPage';
import { ClientsPage } from '@/modules/organization/pages/ClientsPage';
import { ClientWorkspacePage } from '@/modules/organization/pages/ClientWorkspacePage';
import { ClientFormPage } from '@/modules/organization/pages/ClientFormPage';
import { VendorsPage } from '@/modules/organization/pages/VendorsPage';
import { VendorWorkspacePage } from '@/modules/organization/pages/VendorWorkspacePage';
import { VendorFormPage } from '@/modules/organization/pages/VendorFormPage';

// People Module Pages
import { PeoplePage } from '@/modules/organization/pages/PeoplePage';
import { PersonWorkspacePage } from '@/modules/people/pages/PersonWorkspacePage';
import { CreatePersonPage } from '@/modules/people/pages/CreatePersonPage';
import { EditPersonPage } from '@/modules/people/pages/EditPersonPage';

// Department Module Pages
import { DepartmentsPage } from '@/modules/organization/pages/DepartmentsPage';
import { DepartmentWorkspacePage } from '@/modules/departments/pages/DepartmentWorkspacePage';
import { CreateDepartmentPage } from '@/modules/departments/pages/CreateDepartmentPage';
import { EditDepartmentPage } from '@/modules/departments/pages/EditDepartmentPage';

// Team Module Pages
import { TeamsPage } from '@/modules/organization/pages/TeamsPage';
import { TeamWorkspacePage } from '@/modules/teams/pages/TeamWorkspacePage';
import { CreateTeamPage } from '@/modules/teams/pages/CreateTeamPage';
import { EditTeamPage } from '@/modules/teams/pages/EditTeamPage';

// Office Module Pages
import { OfficesPage } from '@/modules/organization/pages/OfficesPage';
import { OfficeWorkspacePage } from '@/modules/offices/pages/OfficeWorkspacePage';
import { CreateOfficePage } from '@/modules/offices/pages/CreateOfficePage';
import { EditOfficePage } from '@/modules/offices/pages/EditOfficePage';

// Production & Platform Pages
import { VersionsListPage } from '@/modules/versions/pages/VersionsListPage';
import { VersionWorkspacePage } from '@/modules/versions/pages/VersionWorkspacePage';
import { PublishingPage } from '@/modules/publishing/pages/PublishingPage';
import { DeliveriesPage } from '@/modules/deliveries/pages/DeliveriesPage';
import { DeliveryWorkspacePage } from '@/modules/deliveries/pages/DeliveryWorkspacePage';
import { WorkflowsPage } from '@/modules/workflows/pages/WorkflowsPage';
import { SchedulingPage } from '@/modules/scheduling/pages/SchedulingPage';
import { NotificationsPage } from '@/modules/platform/pages/NotificationsPage';
import { BillingPage } from '@/modules/platform/pages/BillingPage';
import { ReportsPage } from '@/modules/platform/pages/ReportsPage';
import { DataPlatformPage } from '@/modules/platform/pages/DataPlatformPage';

// Platform Intelligence Pages
import { SearchPage } from '@/modules/intelligence/pages/SearchPage';
import { KnowledgePage } from '@/modules/intelligence/pages/KnowledgePage';
import { AIPage } from '@/modules/intelligence/pages/AIPage';
import { AnalyticsPage } from '@/modules/intelligence/pages/AnalyticsPage';
import { IntegrationsPage } from '@/modules/intelligence/pages/IntegrationsPage';
import { AutomationsPage } from '@/modules/intelligence/pages/AutomationsPage';

// System Pages
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

      {/* Protected Studio App Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* HOME & WORKSPACE */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />

          {/* ORGANIZATION FOUNDATION APPS */}
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/organizations/new" element={<CreateOrganizationPage />} />
          <Route path="/organizations/:id" element={<OrganizationWorkspacePage />} />
          <Route path="/organizations/:id/edit" element={<EditOrganizationPage />} />
          {/* CLIENTS */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/new" element={<ClientFormPage />} />
          <Route path="/clients/:id" element={<ClientWorkspacePage />} />
          <Route path="/clients/:id/edit" element={<ClientFormPage />} />

          {/* VENDORS */}
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/vendors/new" element={<VendorFormPage />} />
          <Route path="/vendors/:id" element={<VendorWorkspacePage />} />
          <Route path="/vendors/:id/edit" element={<VendorFormPage />} />

          {/* PEOPLE */}
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/new" element={<CreatePersonPage />} />
          <Route path="/people/:id" element={<PersonWorkspacePage />} />
          <Route path="/people/:id/edit" element={<EditPersonPage />} />

          {/* DEPARTMENTS */}
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/departments/new" element={<CreateDepartmentPage />} />
          <Route path="/departments/:id" element={<DepartmentWorkspacePage />} />
          <Route path="/departments/:id/edit" element={<EditDepartmentPage />} />

          {/* TEAMS */}
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/new" element={<CreateTeamPage />} />
          <Route path="/teams/:id" element={<TeamWorkspacePage />} />
          <Route path="/teams/:id/edit" element={<EditTeamPage />} />

          {/* OFFICES */}
          <Route path="/offices" element={<OfficesPage />} />
          <Route path="/offices/new" element={<CreateOfficePage />} />
          <Route path="/offices/:id" element={<OfficeWorkspacePage />} />
          <Route path="/offices/:id/edit" element={<EditOfficePage />} />

          {/* PRODUCTION APPS */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
          <Route path="/projects/:id/assets" element={<ProjectWorkspacePage />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="/shots" element={<ShotsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/:assetId" element={<AssetWorkspacePage />} />
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
          <Route path="/calendar" element={<SchedulingPage />} />

          {/* INTELLIGENCE & KNOWLEDGE APPS */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/knowledge/:id" element={<KnowledgePage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/copilot" element={<AIPage />} />
          <Route path="/intelligence" element={<AIPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/automations" element={<AutomationsPage />} />

          {/* PLATFORM APPS */}
          <Route path="/data-platform" element={<DataPlatformPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
          <Route path="/activity" element={<AuditLogsPage />} />
          <Route path="/testing" element={<TestingPage />} />
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
