import { platformRoutes } from '@/modules/platform';

import { DashboardPage } from '@/modules/dashboard';

import { DeliveriesPage, DeliveryFormPage, DeliveryWorkspacePage, DestinationFormPage, DestinationsPage } from '@/modules/deliveries';

import { DepartmentsListPage, DepartmentWorkspacePage, CreateDepartmentPage, EditDepartmentPage } from '@/modules/departments';

import { OfficesListPage, OfficeWorkspacePage, CreateOfficePage, EditOfficePage } from '@/modules/offices';

import { PeopleListPage, PersonWorkspacePage, CreatePersonPage, EditPersonPage } from '@/modules/people';

import { ClientsPage, ClientCreatePage, ClientEditPage, ClientWorkspacePage } from '@/modules/clients';

import { VendorsPage, VendorCreatePage, VendorEditPage, VendorWorkspacePage } from '@/modules/vendors';

import { BulkRegisterPage, PublishDestinationFormPage, PublishDestinationsPage, PublishedFileFormPage, PublishedFilePage, PublishedFilesPage, PublishFormPage, PublishingPage, PublishWorkspacePage, StorageRootFormPage, StorageRootsPage } from '@/modules/publishing';

import { BookingFormPage, BookingsPage, EventFormPage, EventsPage, HolidayFormPage, HolidaysPage, LeaveFormPage, LeavesPage, MilestoneFormPage, MilestonesPage, ResourceFormPage, ResourcesPage, ResourceWorkspacePage, SchedulingCalendarPage, SchedulingCapacityPage, WorkCalendarFormPage, WorkCalendarsPage } from '@/modules/scheduling';

import { TeamsListPage, TeamWorkspacePage, CreateTeamPage, EditTeamPage } from '@/modules/teams';

import { WorkspacePage } from '@/modules/workspace';
import { AccountLayout } from '@/modules/identity/account/AccountLayout';
import { ProfilePage } from '@/modules/identity/account/ProfilePage';
import { SecurityPage } from '@/modules/identity/account/SecurityPage';
import { SessionsPage } from '@/modules/identity/account/SessionsPage';
import { TokensPage } from '@/modules/identity/account/TokensPage';
import { CreatePositionPage, EditPositionPage, PositionsListPage } from '@/modules/directory/positionPages';
import { GroupDetailPage } from '@/modules/identity/pages/GroupDetailPage';
import { GroupsPage } from '@/modules/identity/pages/GroupsPage';
import { PermissionsPage } from '@/modules/identity/pages/PermissionsPage';
import { RoleDetailPage } from '@/modules/identity/pages/RoleDetailPage';
import { RolesPage } from '@/modules/identity/pages/RolesPage';
import { SecurityLogPage } from '@/modules/identity/pages/SecurityLogPage';
import { PreserveQueryRedirect } from './PreserveQueryRedirect';

import { AutomationFormPage, AutomationsPage, WorkflowFormPage, WorkflowsPage, WorkflowWorkspacePage } from '@/modules/workflows';
import { MediaFormPage, MediaPage } from '@/modules/media';

import { PlaylistFormPage, PlaylistsPage, PlaylistWorkspacePage } from '@/modules/playlists';
import { ReviewFormPage, ReviewsPage, ReviewWorkspacePage } from '@/modules/reviews';

import { auditRoutes } from '@/modules/audit';

import { AssetFormPage, AssetsPage, AssetWorkspacePage } from '@/modules/assets';

import { VersionFormPage, VersionsListPage, VersionWorkspacePage } from '@/modules/versions';

import { ShotFormPage, ShotsPage, ShotWorkspacePage } from '@/modules/shots';

import { TasksPage, TaskDetailPage, TaskFormPage, TaskTemplateFormPage, TaskTemplatesPage, TimelogFormPage, TimelogsPage } from '@/modules/tasks';

import { ProjectsPage, ProjectWorkspacePage, ProjectFormPage } from '@/modules/production';

import { LoginPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage, MfaSetupPage } from '@/modules/auth';

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


export const AppRoutes: React.FC = () => {

  return (

    <Routes>

      {/* Guest Only Routes */}

      <Route element={<GuestRoute />}>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

      </Route>

      {/* Authenticated Studio App Routes */}

      <Route element={<AuthenticatedRoute />}>

        {/* Forced credential rotation: rendered outside AppLayout so no other
            authenticated content is reachable while the flag is set. */}

        <Route path="/auth/change-password" element={<ChangePasswordPage />} />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />

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

          {/* POSITIONS */}

          <Route path="/positions" element={<PositionsListPage />} />

          <Route path="/positions/new" element={<CreatePositionPage />} />

          <Route element={<PermissionRoute permissions={['position.update']} />}>

            <Route path="/positions/:id/edit" element={<EditPositionPage />} />

          </Route>

          {/* CLIENTS & VENDORS */}

          <Route path="/clients" element={<ClientsPage />} />

          <Route element={<PermissionRoute permissions={['client.create']} />}>

            <Route path="/clients/new" element={<ClientCreatePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['client.view']} />}>

            <Route path="/clients/:id" element={<ClientWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['client.update']} />}>

            <Route path="/clients/:id/edit" element={<ClientEditPage />} />

          </Route>

          <Route path="/vendors" element={<VendorsPage />} />

          <Route element={<PermissionRoute permissions={['vendor.create']} />}>

            <Route path="/vendors/new" element={<VendorCreatePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['vendor.view']} />}>

            <Route path="/vendors/:id" element={<VendorWorkspacePage />} />

          </Route>

          <Route element={<PermissionRoute permissions={['vendor.update']} />}>

            <Route path="/vendors/:id/edit" element={<VendorEditPage />} />

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

          <Route path="/shots/new" element={<ShotFormPage />} />

          <Route path="/shots/:id/edit" element={<ShotFormPage />} />

          <Route path="/shots/:shotId" element={<ShotWorkspacePage />} />

          <Route path="/shots/:shotId/:tab" element={<ShotWorkspacePage />} />

          <Route path="/projects/:projectId/shots/:shotId" element={<ShotWorkspacePage />} />

          <Route path="/projects/:projectId/shots/:shotId/:tab" element={<ShotWorkspacePage />} />

          <Route path="/assets" element={<AssetsPage />} />

          <Route path="/assets/new" element={<AssetFormPage />} />

          <Route path="/assets/:id/edit" element={<AssetFormPage />} />

          <Route path="/assets/:assetId" element={<AssetWorkspacePage />} />

          <Route path="/assets/:assetId/:tab" element={<AssetWorkspacePage />} />

          <Route path="/projects/:projectId/assets/:assetId" element={<AssetWorkspacePage />} />

          <Route path="/projects/:projectId/assets/:assetId/:tab" element={<AssetWorkspacePage />} />

          <Route path="/tasks" element={<TasksPage />} />

          <Route path="/tasks/new" element={<TaskFormPage />} />

          <Route path="/task-templates" element={<TaskTemplatesPage />} />

          <Route path="/task-templates/new" element={<TaskTemplateFormPage />} />

          <Route path="/task-templates/:id/edit" element={<TaskTemplateFormPage />} />

          <Route path="/tasks/:id/edit" element={<TaskFormPage />} />

          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />

          <Route path="/timelogs" element={<TimelogsPage />} />

          <Route path="/timelogs/new" element={<TimelogFormPage />} />

          <Route path="/timelogs/:id/edit" element={<TimelogFormPage />} />

          <Route path="/versions" element={<VersionsListPage />} />

          <Route path="/versions/new" element={<VersionFormPage />} />

          <Route path="/versions/:id/edit" element={<VersionFormPage />} />

          <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />

          <Route path="/publishing" element={<PublishingPage />} />

          <Route path="/publishing/new" element={<PublishFormPage />} />

          <Route path="/publishing/files" element={<PublishedFilesPage />} />

          <Route path="/publishing/files/new" element={<PublishedFileFormPage />} />

          <Route path="/publishing/files/bulk" element={<BulkRegisterPage />} />

          <Route path="/publishing/files/:fileId" element={<PublishedFilePage />} />

          <Route path="/publishing/storage-roots" element={<StorageRootsPage />} />

          <Route path="/publishing/storage-roots/new" element={<StorageRootFormPage />} />

          <Route path="/publishing/storage-roots/:id/edit" element={<StorageRootFormPage />} />

          <Route path="/publishing/destinations" element={<PublishDestinationsPage />} />

          <Route path="/publishing/destinations/new" element={<PublishDestinationFormPage />} />

          <Route path="/publishing/destinations/:id/edit" element={<PublishDestinationFormPage />} />

          <Route path="/publishing/:id/edit" element={<PublishFormPage />} />

          <Route path="/publishing/:publishId" element={<PublishWorkspacePage />} />

          <Route path="/deliveries" element={<DeliveriesPage />} />

          <Route path="/deliveries/new" element={<DeliveryFormPage />} />

          <Route path="/deliveries/destinations" element={<DestinationsPage />} />

          <Route path="/deliveries/destinations/new" element={<DestinationFormPage />} />

          <Route path="/deliveries/destinations/:id/edit" element={<DestinationFormPage />} />

          <Route path="/deliveries/:id/edit" element={<DeliveryFormPage />} />

          <Route path="/deliveries/:deliveryId" element={<DeliveryWorkspacePage />} />

          <Route path="/reviews" element={<ReviewsPage />} />

          <Route path="/reviews/new" element={<ReviewFormPage />} />

          <Route path="/reviews/:id/edit" element={<ReviewFormPage />} />

          <Route path="/reviews/:reviewId" element={<ReviewWorkspacePage />} />

          <Route path="/playlists" element={<PlaylistsPage />} />

          <Route path="/playlists/new" element={<PlaylistFormPage />} />

          <Route path="/playlists/:id/edit" element={<PlaylistFormPage />} />

          <Route path="/playlists/:playlistId" element={<PlaylistWorkspacePage />} />

          <Route path="/workflows" element={<WorkflowsPage />} />

          <Route path="/workflows/new" element={<WorkflowFormPage />} />

          <Route path="/workflows/:id/edit" element={<WorkflowFormPage />} />

          <Route path="/workflows/:workflowId" element={<WorkflowWorkspacePage />} />

          <Route path="/automations" element={<AutomationsPage />} />

          <Route path="/automations/new" element={<AutomationFormPage />} />

          <Route path="/automations/:id/edit" element={<AutomationFormPage />} />

          <Route path="/media" element={<MediaPage />} />

          <Route path="/media/new" element={<MediaFormPage />} />

          <Route path="/media/:id/edit" element={<MediaFormPage />} />

          <Route path="/scheduling" element={<SchedulingCalendarPage />} />
          <Route path="/scheduling/capacity" element={<SchedulingCapacityPage />} />
          <Route path="/scheduling/resources" element={<ResourcesPage />} />
          <Route path="/scheduling/resources/new" element={<ResourceFormPage />} />
          <Route path="/scheduling/resources/:id/edit" element={<ResourceFormPage />} />
          <Route path="/scheduling/resources/:resourceId" element={<ResourceWorkspacePage />} />
          <Route path="/scheduling/bookings" element={<BookingsPage />} />
          <Route path="/scheduling/bookings/new" element={<BookingFormPage />} />
          <Route path="/scheduling/bookings/:id/edit" element={<BookingFormPage />} />
          <Route path="/scheduling/leaves" element={<LeavesPage />} />
          <Route path="/scheduling/leaves/new" element={<LeaveFormPage />} />
          <Route path="/scheduling/leaves/:id/edit" element={<LeaveFormPage />} />
          <Route path="/scheduling/events" element={<EventsPage />} />
          <Route path="/scheduling/events/new" element={<EventFormPage />} />
          <Route path="/scheduling/events/:id/edit" element={<EventFormPage />} />
          <Route path="/scheduling/milestones" element={<MilestonesPage />} />
          <Route path="/scheduling/milestones/new" element={<MilestoneFormPage />} />
          <Route path="/scheduling/milestones/:id/edit" element={<MilestoneFormPage />} />
          <Route path="/scheduling/holidays" element={<HolidaysPage />} />
          <Route path="/scheduling/holidays/new" element={<HolidayFormPage />} />
          <Route path="/scheduling/holidays/:id/edit" element={<HolidayFormPage />} />
          <Route path="/scheduling/calendars" element={<WorkCalendarsPage />} />
          <Route path="/scheduling/calendars/new" element={<WorkCalendarFormPage />} />
          <Route path="/scheduling/calendars/:id/edit" element={<WorkCalendarFormPage />} />

          <Route path="/calendar" element={<PreserveQueryRedirect to="/scheduling" />} />

          {/* PLATFORM APPS */}

          {platformRoutes}

          {/* My account (personal settings): any signed-in user. System settings arrive under /settings/system in Phase 11. */}
          <Route path="/settings" element={<Navigate to="/settings/account/profile" replace />} />

          <Route path="/settings/account" element={<Navigate to="/settings/account/profile" replace />} />

          <Route path="/settings/account/profile" element={<AccountLayout><ProfilePage /></AccountLayout>} />

          <Route path="/settings/account/security" element={<AccountLayout><SecurityPage /></AccountLayout>} />

          <Route path="/settings/account/sessions" element={<AccountLayout><SessionsPage /></AccountLayout>} />

          <Route path="/settings/account/tokens" element={<AccountLayout><TokensPage /></AccountLayout>} />

          {/* Access & RBAC workspace — the org-free RBAC surface (Task 12
              sections) is reachable at /access[/:section]; /permissions and
              /settings/permissions are legacy aliases into it. */}
          <Route element={<PermissionRoute permissions={['roles.view', 'security.view']} requireAny={true} />}>

            <Route path="/settings/permissions" element={<PreserveQueryRedirect to="/access" />} />

            <Route path="/permissions" element={<PreserveQueryRedirect to="/access" />} />

            <Route path="/access" element={<Navigate to="/access/roles" replace />} />

            <Route path="/access/roles" element={<RolesPage />} />

            <Route path="/access/roles/:roleId" element={<RoleDetailPage />} />

            <Route path="/access/groups" element={<GroupsPage />} />

            <Route path="/access/groups/:groupId" element={<GroupDetailPage />} />

            <Route path="/access/permissions" element={<PermissionsPage />} />

            <Route path="/access/security" element={<SecurityLogPage />} />

          </Route>

          {auditRoutes}

          <Route element={<PermissionRoute requireAdmin={true} pagePermission="page.testing" permissions={['testing.view']} requireAny={true} fallbackPath="/forbidden" />}>


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
