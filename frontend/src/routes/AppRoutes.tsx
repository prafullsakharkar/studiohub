import { platformRoutes } from '@/modules/platform';

import { auditRoutes } from '@/modules/audit';

import { LoginPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage, MfaSetupPage } from '@/modules/auth';

import React, { Suspense } from 'react';
import { lazyNamed } from './lazyNamed';

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

// Pages load on first use, one chunk per module (see lazyNamed).
const DashboardPage = lazyNamed(() => import('@/modules/dashboard'), 'DashboardPage');
const DeliveriesPage = lazyNamed(() => import('@/modules/deliveries'), 'DeliveriesPage');
const DeliveryFormPage = lazyNamed(() => import('@/modules/deliveries'), 'DeliveryFormPage');
const DeliveryWorkspacePage = lazyNamed(() => import('@/modules/deliveries'), 'DeliveryWorkspacePage');
const DestinationFormPage = lazyNamed(() => import('@/modules/deliveries'), 'DestinationFormPage');
const DestinationsPage = lazyNamed(() => import('@/modules/deliveries'), 'DestinationsPage');
const DepartmentsListPage = lazyNamed(() => import('@/modules/departments'), 'DepartmentsListPage');
const DepartmentWorkspacePage = lazyNamed(() => import('@/modules/departments'), 'DepartmentWorkspacePage');
const CreateDepartmentPage = lazyNamed(() => import('@/modules/departments'), 'CreateDepartmentPage');
const EditDepartmentPage = lazyNamed(() => import('@/modules/departments'), 'EditDepartmentPage');
const OfficesListPage = lazyNamed(() => import('@/modules/offices'), 'OfficesListPage');
const OfficeWorkspacePage = lazyNamed(() => import('@/modules/offices'), 'OfficeWorkspacePage');
const CreateOfficePage = lazyNamed(() => import('@/modules/offices'), 'CreateOfficePage');
const EditOfficePage = lazyNamed(() => import('@/modules/offices'), 'EditOfficePage');
const PeopleListPage = lazyNamed(() => import('@/modules/people'), 'PeopleListPage');
const PersonWorkspacePage = lazyNamed(() => import('@/modules/people'), 'PersonWorkspacePage');
const CreatePersonPage = lazyNamed(() => import('@/modules/people'), 'CreatePersonPage');
const EditPersonPage = lazyNamed(() => import('@/modules/people'), 'EditPersonPage');
const ClientsPage = lazyNamed(() => import('@/modules/clients'), 'ClientsPage');
const ClientCreatePage = lazyNamed(() => import('@/modules/clients'), 'ClientCreatePage');
const ClientEditPage = lazyNamed(() => import('@/modules/clients'), 'ClientEditPage');
const ClientWorkspacePage = lazyNamed(() => import('@/modules/clients'), 'ClientWorkspacePage');
const VendorsPage = lazyNamed(() => import('@/modules/vendors'), 'VendorsPage');
const VendorCreatePage = lazyNamed(() => import('@/modules/vendors'), 'VendorCreatePage');
const VendorEditPage = lazyNamed(() => import('@/modules/vendors'), 'VendorEditPage');
const VendorWorkspacePage = lazyNamed(() => import('@/modules/vendors'), 'VendorWorkspacePage');
const BulkRegisterPage = lazyNamed(() => import('@/modules/publishing'), 'BulkRegisterPage');
const PublishDestinationFormPage = lazyNamed(() => import('@/modules/publishing'), 'PublishDestinationFormPage');
const PublishDestinationsPage = lazyNamed(() => import('@/modules/publishing'), 'PublishDestinationsPage');
const PublishedFileFormPage = lazyNamed(() => import('@/modules/publishing'), 'PublishedFileFormPage');
const PublishedFilePage = lazyNamed(() => import('@/modules/publishing'), 'PublishedFilePage');
const PublishedFilesPage = lazyNamed(() => import('@/modules/publishing'), 'PublishedFilesPage');
const PublishFormPage = lazyNamed(() => import('@/modules/publishing'), 'PublishFormPage');
const PublishingPage = lazyNamed(() => import('@/modules/publishing'), 'PublishingPage');
const PublishWorkspacePage = lazyNamed(() => import('@/modules/publishing'), 'PublishWorkspacePage');
const StorageRootFormPage = lazyNamed(() => import('@/modules/publishing'), 'StorageRootFormPage');
const StorageRootsPage = lazyNamed(() => import('@/modules/publishing'), 'StorageRootsPage');
const CategoriesPage = lazyNamed(() => import('@/modules/settings'), 'CategoriesPage');
const CategoryFormPage = lazyNamed(() => import('@/modules/settings'), 'CategoryFormPage');
const DefinitionFormPage = lazyNamed(() => import('@/modules/settings'), 'DefinitionFormPage');
const DefinitionsPage = lazyNamed(() => import('@/modules/settings'), 'DefinitionsPage');
const FlagFormPage = lazyNamed(() => import('@/modules/settings'), 'FlagFormPage');
const FlagsPage = lazyNamed(() => import('@/modules/settings'), 'FlagsPage');
const LocalizationFormPage = lazyNamed(() => import('@/modules/settings'), 'LocalizationFormPage');
const LocalizationsPage = lazyNamed(() => import('@/modules/settings'), 'LocalizationsPage');
const TagFormPage = lazyNamed(() => import('@/modules/settings'), 'TagFormPage');
const TagsPage = lazyNamed(() => import('@/modules/settings'), 'TagsPage');
const ThemeFormPage = lazyNamed(() => import('@/modules/settings'), 'ThemeFormPage');
const ThemesPage = lazyNamed(() => import('@/modules/settings'), 'ThemesPage');
const ValueFormPage = lazyNamed(() => import('@/modules/settings'), 'ValueFormPage');
const ValuesPage = lazyNamed(() => import('@/modules/settings'), 'ValuesPage');const BookingFormPage = lazyNamed(() => import('@/modules/scheduling'), 'BookingFormPage');
const BookingsPage = lazyNamed(() => import('@/modules/scheduling'), 'BookingsPage');
const EventFormPage = lazyNamed(() => import('@/modules/scheduling'), 'EventFormPage');
const EventsPage = lazyNamed(() => import('@/modules/scheduling'), 'EventsPage');
const HolidayFormPage = lazyNamed(() => import('@/modules/scheduling'), 'HolidayFormPage');
const HolidaysPage = lazyNamed(() => import('@/modules/scheduling'), 'HolidaysPage');
const LeaveFormPage = lazyNamed(() => import('@/modules/scheduling'), 'LeaveFormPage');
const LeavesPage = lazyNamed(() => import('@/modules/scheduling'), 'LeavesPage');
const MilestoneFormPage = lazyNamed(() => import('@/modules/scheduling'), 'MilestoneFormPage');
const MilestonesPage = lazyNamed(() => import('@/modules/scheduling'), 'MilestonesPage');
const ResourceFormPage = lazyNamed(() => import('@/modules/scheduling'), 'ResourceFormPage');
const ResourcesPage = lazyNamed(() => import('@/modules/scheduling'), 'ResourcesPage');
const ResourceWorkspacePage = lazyNamed(() => import('@/modules/scheduling'), 'ResourceWorkspacePage');
const SchedulingCalendarPage = lazyNamed(() => import('@/modules/scheduling'), 'SchedulingCalendarPage');
const SchedulingCapacityPage = lazyNamed(() => import('@/modules/scheduling'), 'SchedulingCapacityPage');
const WorkCalendarFormPage = lazyNamed(() => import('@/modules/scheduling'), 'WorkCalendarFormPage');
const WorkCalendarsPage = lazyNamed(() => import('@/modules/scheduling'), 'WorkCalendarsPage');
const TeamsListPage = lazyNamed(() => import('@/modules/teams'), 'TeamsListPage');
const TeamWorkspacePage = lazyNamed(() => import('@/modules/teams'), 'TeamWorkspacePage');
const CreateTeamPage = lazyNamed(() => import('@/modules/teams'), 'CreateTeamPage');
const EditTeamPage = lazyNamed(() => import('@/modules/teams'), 'EditTeamPage');
const WorkspacePage = lazyNamed(() => import('@/modules/workspace'), 'WorkspacePage');const AccountLayout = lazyNamed(() => import('@/modules/identity/account/AccountLayout'), 'AccountLayout');const ProfilePage = lazyNamed(() => import('@/modules/identity/account/ProfilePage'), 'ProfilePage');const SecurityPage = lazyNamed(() => import('@/modules/identity/account/SecurityPage'), 'SecurityPage');const SessionsPage = lazyNamed(() => import('@/modules/identity/account/SessionsPage'), 'SessionsPage');const TokensPage = lazyNamed(() => import('@/modules/identity/account/TokensPage'), 'TokensPage');const CreatePositionPage = lazyNamed(() => import('@/modules/directory/positionPages'), 'CreatePositionPage');
const EditPositionPage = lazyNamed(() => import('@/modules/directory/positionPages'), 'EditPositionPage');
const PositionsListPage = lazyNamed(() => import('@/modules/directory/positionPages'), 'PositionsListPage');const GroupDetailPage = lazyNamed(() => import('@/modules/identity/pages/GroupDetailPage'), 'GroupDetailPage');const GroupsPage = lazyNamed(() => import('@/modules/identity/pages/GroupsPage'), 'GroupsPage');const PermissionsPage = lazyNamed(() => import('@/modules/identity/pages/PermissionsPage'), 'PermissionsPage');const RoleDetailPage = lazyNamed(() => import('@/modules/identity/pages/RoleDetailPage'), 'RoleDetailPage');const RolesPage = lazyNamed(() => import('@/modules/identity/pages/RolesPage'), 'RolesPage');const SecurityLogPage = lazyNamed(() => import('@/modules/identity/pages/SecurityLogPage'), 'SecurityLogPage');import { PreserveQueryRedirect } from './PreserveQueryRedirect';
const AutomationFormPage = lazyNamed(() => import('@/modules/workflows'), 'AutomationFormPage');
const AutomationsPage = lazyNamed(() => import('@/modules/workflows'), 'AutomationsPage');
const WorkflowFormPage = lazyNamed(() => import('@/modules/workflows'), 'WorkflowFormPage');
const WorkflowsPage = lazyNamed(() => import('@/modules/workflows'), 'WorkflowsPage');
const WorkflowWorkspacePage = lazyNamed(() => import('@/modules/workflows'), 'WorkflowWorkspacePage');const MediaFormPage = lazyNamed(() => import('@/modules/media'), 'MediaFormPage');
const MediaPage = lazyNamed(() => import('@/modules/media'), 'MediaPage');
const PlaylistFormPage = lazyNamed(() => import('@/modules/playlists'), 'PlaylistFormPage');
const PlaylistsPage = lazyNamed(() => import('@/modules/playlists'), 'PlaylistsPage');
const PlaylistWorkspacePage = lazyNamed(() => import('@/modules/playlists'), 'PlaylistWorkspacePage');const ReviewFormPage = lazyNamed(() => import('@/modules/reviews'), 'ReviewFormPage');
const ReviewsPage = lazyNamed(() => import('@/modules/reviews'), 'ReviewsPage');
const ReviewWorkspacePage = lazyNamed(() => import('@/modules/reviews'), 'ReviewWorkspacePage');
const AssetFormPage = lazyNamed(() => import('@/modules/assets'), 'AssetFormPage');
const AssetsPage = lazyNamed(() => import('@/modules/assets'), 'AssetsPage');
const AssetWorkspacePage = lazyNamed(() => import('@/modules/assets'), 'AssetWorkspacePage');
const VersionFormPage = lazyNamed(() => import('@/modules/versions'), 'VersionFormPage');
const VersionsListPage = lazyNamed(() => import('@/modules/versions'), 'VersionsListPage');
const VersionWorkspacePage = lazyNamed(() => import('@/modules/versions'), 'VersionWorkspacePage');
const ShotFormPage = lazyNamed(() => import('@/modules/shots'), 'ShotFormPage');
const ShotsPage = lazyNamed(() => import('@/modules/shots'), 'ShotsPage');
const ShotWorkspacePage = lazyNamed(() => import('@/modules/shots'), 'ShotWorkspacePage');
const TasksPage = lazyNamed(() => import('@/modules/tasks'), 'TasksPage');
const TaskDetailPage = lazyNamed(() => import('@/modules/tasks'), 'TaskDetailPage');
const TaskFormPage = lazyNamed(() => import('@/modules/tasks'), 'TaskFormPage');
const TaskTemplateFormPage = lazyNamed(() => import('@/modules/tasks'), 'TaskTemplateFormPage');
const TaskTemplatesPage = lazyNamed(() => import('@/modules/tasks'), 'TaskTemplatesPage');
const TimelogFormPage = lazyNamed(() => import('@/modules/tasks'), 'TimelogFormPage');
const TimelogsPage = lazyNamed(() => import('@/modules/tasks'), 'TimelogsPage');
const ProjectsPage = lazyNamed(() => import('@/modules/production'), 'ProjectsPage');
const ProjectWorkspacePage = lazyNamed(() => import('@/modules/production'), 'ProjectWorkspacePage');
const ProjectFormPage = lazyNamed(() => import('@/modules/production'), 'ProjectFormPage');

/** Shown while the first page of a section downloads. */
const RouteFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex h-screen w-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
    Loading…
  </div>
);

export const AppRoutes: React.FC = () => {

  return (
    <Suspense fallback={<RouteFallback />}>
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

          {/* My account (personal settings): any signed-in user. System settings: settings.view reads, settings.manage writes. */}
          <Route path="/settings" element={<Navigate to="/settings/account/profile" replace />} />

          <Route path="/settings/account" element={<Navigate to="/settings/account/profile" replace />} />

          <Route path="/settings/account/profile" element={<AccountLayout><ProfilePage /></AccountLayout>} />

          <Route path="/settings/account/security" element={<AccountLayout><SecurityPage /></AccountLayout>} />

          <Route path="/settings/account/sessions" element={<AccountLayout><SessionsPage /></AccountLayout>} />

          <Route path="/settings/account/tokens" element={<AccountLayout><TokensPage /></AccountLayout>} />

          <Route element={<PermissionRoute permissions={['settings.view']} />}>
            <Route path="/settings/system" element={<Navigate to="/settings/system/values" replace />} />
            <Route path="/settings/system/values" element={<ValuesPage />} />
            <Route path="/settings/system/values/new" element={<ValueFormPage />} />
            <Route path="/settings/system/values/:id/edit" element={<ValueFormPage />} />
            <Route path="/settings/system/flags" element={<FlagsPage />} />
            <Route path="/settings/system/flags/new" element={<FlagFormPage />} />
            <Route path="/settings/system/flags/:id/edit" element={<FlagFormPage />} />
            <Route path="/settings/system/themes" element={<ThemesPage />} />
            <Route path="/settings/system/themes/new" element={<ThemeFormPage />} />
            <Route path="/settings/system/themes/:id/edit" element={<ThemeFormPage />} />
            <Route path="/settings/system/localizations" element={<LocalizationsPage />} />
            <Route path="/settings/system/localizations/new" element={<LocalizationFormPage />} />
            <Route path="/settings/system/localizations/:id/edit" element={<LocalizationFormPage />} />
            <Route path="/settings/system/categories" element={<CategoriesPage />} />
            <Route path="/settings/system/categories/new" element={<CategoryFormPage />} />
            <Route path="/settings/system/categories/:id/edit" element={<CategoryFormPage />} />
            <Route path="/settings/system/definitions" element={<DefinitionsPage />} />
            <Route path="/settings/system/definitions/new" element={<DefinitionFormPage />} />
            <Route path="/settings/system/definitions/:id/edit" element={<DefinitionFormPage />} />
            <Route path="/settings/system/tags" element={<TagsPage />} />
            <Route path="/settings/system/tags/new" element={<TagFormPage />} />
            <Route path="/settings/system/tags/:id/edit" element={<TagFormPage />} />
          </Route>

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
    </Suspense>
  );
};
