import { RoutePermissionMetadata } from '@/types/identity';
import { User, getUserMembershipType } from '@/types/identity';
import { evaluateUserPermission, checkUserHasProjectAccess, isBreakGlass } from './rbac';
import { PermissionEvaluationContext } from '@/types/identity';

export const ROUTE_PERMISSIONS_REGISTRY: Record<string, RoutePermissionMetadata> = {
  // Dashboard & Workspace
  '/dashboard': {
    path: '/dashboard',
    name: 'Dashboard',
    pagePermission: 'page.dashboard',
  },
  '/workspace': {
    path: '/workspace',
    name: 'Workspace',
    pagePermission: 'page.workspace',
  },

  // Entity workspaces
  '/clients': {
    path: '/clients',
    name: 'Clients',
    pagePermission: 'page.clients',
    permissions: ['client.view'],
  },
  '/clients/new': {
    path: '/clients/new',
    name: 'Create Client',
    permissions: ['client.create'],
  },
  '/vendors': {
    path: '/vendors',
    name: 'Vendors',
    pagePermission: 'page.vendors',
    permissions: ['vendor.view'],
  },
  '/vendors/new': {
    path: '/vendors/new',
    name: 'Create Vendor',
    permissions: ['vendor.create'],
  },
  '/people': {
    path: '/people',
    name: 'People',
    pagePermission: 'page.people',
    permissions: ['people.view'],
  },
  '/people/new': {
    path: '/people/new',
    name: 'Create Person',
    permissions: ['people.create'],
  },
  '/departments': {
    path: '/departments',
    name: 'Departments',
    pagePermission: 'page.departments',
    permissions: ['department.view'],
  },
  '/departments/new': {
    path: '/departments/new',
    name: 'Create Department',
    permissions: ['department.create'],
  },
  '/teams': {
    path: '/teams',
    name: 'Teams',
    pagePermission: 'page.teams',
    permissions: ['team.view'],
  },
  '/teams/new': {
    path: '/teams/new',
    name: 'Create Team',
    permissions: ['team.create'],
  },
  '/platform/catalog': { path: '/platform/catalog', name: 'Catalog', pagePermission: 'page.catalog' },
  '/platform/catalog/:kind': { path: '/platform/catalog/:kind', name: 'Catalog section', pagePermission: 'page.catalog' },
  '/positions': {
    path: '/positions',
    name: 'Positions',
    pagePermission: 'page.positions',
    permissions: ['position.view'],
  },
  '/positions/new': {
    path: '/positions/new',
    name: 'Create Position',
    permissions: ['position.create'],
  },
  '/positions/:id/edit': {
    path: '/positions/:id/edit',
    name: 'Edit Position',
    permissions: ['position.update'],
  },
  '/offices': {
    path: '/offices',
    name: 'Offices',
    pagePermission: 'page.offices',
    permissions: ['office.view'],
  },
  '/offices/new': {
    path: '/offices/new',
    name: 'Create Office',
    permissions: ['office.create'],
  },

  // My account: personal settings of the signed-in user. No permission code applies; every
  // endpoint behind these pages acts on the caller's own record (or is gated server-side).
  '/settings/account': { path: '/settings/account', name: 'My account', pagePermission: 'page.account' },
  '/settings/account/profile': { path: '/settings/account/profile', name: 'My profile', pagePermission: 'page.account' },
  '/settings/account/security': { path: '/settings/account/security', name: 'My security', pagePermission: 'page.account' },
  '/settings/account/sessions': { path: '/settings/account/sessions', name: 'My sessions', pagePermission: 'page.account' },
  '/settings/account/tokens': { path: '/settings/account/tokens', name: 'My access tokens', pagePermission: 'page.account' },

  // Access management routes (project-scoped, no org path segment)
  '/access': {
    path: '/access',
    name: 'Access Management Workspace (context)',
    pagePermission: 'page.permissions',
    permissions: ['roles.view', 'security.view'],
  },
  '/access/:section': {
    path: '/access/:section',
    name: 'Access Administration Section',
    pagePermission: 'page.permissions',
    permissions: ['roles.view', 'security.view'],
  },
  '/access/:section/:id': {
    path: '/access/:section/:id',
    name: 'Access Administration Record',
    pagePermission: 'page.permissions',
    permissions: ['roles.view', 'security.view'],
  },
  '/clients/:id': {
    path: '/clients/:id',
    name: 'Client Workspace',
    pagePermission: 'page.clients',
    permissions: ['client.view'],
  },
  '/clients/:id/edit': {
    path: '/clients/:id/edit',
    name: 'Edit Client',
    permissions: ['client.update'],
  },
  '/vendors/:id': {
    path: '/vendors/:id',
    name: 'Vendor Workspace',
    pagePermission: 'page.vendors',
    permissions: ['vendor.view'],
  },
  '/vendors/:id/edit': {
    path: '/vendors/:id/edit',
    name: 'Edit Vendor',
    permissions: ['vendor.update'],
  },
  '/people/:id': {
    path: '/people/:id',
    name: 'Person Workspace',
    pagePermission: 'page.people',
    permissions: ['people.view'],
  },
  '/people/:id/edit': {
    path: '/people/:id/edit',
    name: 'Edit Person',
    permissions: ['people.update'],
  },
  '/departments/:id': {
    path: '/departments/:id',
    name: 'Department Workspace',
    pagePermission: 'page.departments',
    permissions: ['department.view'],
  },
  '/departments/:id/edit': {
    path: '/departments/:id/edit',
    name: 'Edit Department',
    permissions: ['department.update'],
  },
  '/teams/:id': {
    path: '/teams/:id',
    name: 'Team Workspace',
    pagePermission: 'page.teams',
    permissions: ['team.view'],
  },
  '/teams/:id/edit': {
    path: '/teams/:id/edit',
    name: 'Edit Team',
    permissions: ['team.update'],
  },
  '/offices/:id': {
    path: '/offices/:id',
    name: 'Office Workspace',
    pagePermission: 'page.offices',
    permissions: ['office.view'],
  },
  '/offices/:id/edit': {
    path: '/offices/:id/edit',
    name: 'Edit Office',
    permissions: ['office.update'],
  },

  // Production Global Routes
  '/projects': {
    path: '/projects',
    name: 'Projects',
    pagePermission: 'page.projects',
    permissions: ['project.view'],
  },
  '/projects/new': {
    path: '/projects/new',
    name: 'Create Project',
    permissions: ['project.create'],
  },
  '/projects/:id': {
    path: '/projects/:id',
    name: 'Project Workspace',
    pagePermission: 'page.project.overview',
    permissions: ['project.view'],
    requiresProjectMembership: true,
  },
  '/shots': {
    path: '/shots',
    name: 'Shots',
    pagePermission: 'page.project.shots',
    permissions: ['shot.view'],
  },
  '/assets': {
    path: '/assets',
    name: 'Assets',
    pagePermission: 'page.project.assets',
    permissions: ['asset.view'],
  },
  '/shots/new': {
    path: '/shots/new',
    name: 'Create Shot',
    permissions: ['shot.create'],
  },
  '/shots/:id/edit': {
    path: '/shots/:id/edit',
    name: 'Edit Shot',
    permissions: ['shot.update'],
  },
  '/assets/new': {
    path: '/assets/new',
    name: 'Create Asset',
    permissions: ['asset.create'],
  },
  '/assets/:id/edit': {
    path: '/assets/:id/edit',
    name: 'Edit Asset',
    permissions: ['asset.update'],
  },
  '/tasks': {
    path: '/tasks',
    name: 'Tasks',
    pagePermission: 'page.project.tasks',
    permissions: ['task.view'],
  },
  '/task-templates': {
    path: '/task-templates',
    name: 'Task Templates',
    permissions: ['tasktemplate.view'],
  },
  '/task-templates/new': {
    path: '/task-templates/new',
    name: 'Create Task Template',
    permissions: ['tasktemplate.create'],
  },
  '/task-templates/:id/edit': {
    path: '/task-templates/:id/edit',
    name: 'Edit Task Template',
    permissions: ['tasktemplate.update'],
  },
  '/tasks/new': {
    path: '/tasks/new',
    name: 'Create Task',
    permissions: ['task.create'],
  },
  '/tasks/:id/edit': {
    path: '/tasks/:id/edit',
    name: 'Edit Task',
    permissions: ['task.update'],
  },
  '/timelogs': {
    path: '/timelogs',
    name: 'Timelogs',
    pagePermission: 'page.project.timelogs',
    permissions: ['timelog.view'],
  },
  '/timelogs/new': {
    path: '/timelogs/new',
    name: 'Log Time',
    permissions: ['timelog.create'],
  },
  '/timelogs/:id/edit': {
    path: '/timelogs/:id/edit',
    name: 'Edit Time Log',
    permissions: ['timelog.update'],
  },
  '/versions/new': {
    path: '/versions/new',
    name: 'Create Version',
    permissions: ['version.create'],
  },
  '/versions/:id/edit': {
    path: '/versions/:id/edit',
    name: 'Edit Version',
    permissions: ['version.update'],
  },
  '/reviews/new': {
    path: '/reviews/new',
    name: 'Create Review',
    permissions: ['review.create'],
  },
  '/reviews/:id/edit': {
    path: '/reviews/:id/edit',
    name: 'Edit Review',
    permissions: ['review.update'],
  },
  '/workflows/new': { path: '/workflows/new', name: 'Create Workflow', permissions: ['workflow.create'] },
  '/workflows/:id/edit': { path: '/workflows/:id/edit', name: 'Edit Workflow', permissions: ['workflow.update'] },
  '/workflows/:workflowId': { path: '/workflows/:workflowId', name: 'Workflow', pagePermission: 'page.project.workflow', permissions: ['workflow.view'] },
  '/automations': { path: '/automations', name: 'Automation rules', permissions: ['automation.view'] },
  '/automations/new': { path: '/automations/new', name: 'Create Automation Rule', permissions: ['automation.create'] },
  '/automations/:id/edit': { path: '/automations/:id/edit', name: 'Edit Automation Rule', permissions: ['automation.update'] },
  '/media': { path: '/media', name: 'Media', pagePermission: 'page.project.files', permissions: ['media.view'] },
  '/media/new': { path: '/media/new', name: 'Create Media', permissions: ['media.create'] },
  '/media/:id/edit': { path: '/media/:id/edit', name: 'Edit Media', permissions: ['media.update'] },
  '/playlists/new': {
    path: '/playlists/new',
    name: 'Create Playlist',
    permissions: ['playlist.create'],
  },
  '/playlists/:id/edit': {
    path: '/playlists/:id/edit',
    name: 'Edit Playlist',
    permissions: ['playlist.update'],
  },
  '/playlists/:playlistId': {
    path: '/playlists/:playlistId',
    name: 'Playlist',
    pagePermission: 'page.project.playlists',
    permissions: ['playlist.view'],
  },
  '/playlists': {
    path: '/playlists',
    name: 'Playlists',
    pagePermission: 'page.project.playlists',
    permissions: ['playlist.view'],
  },
  '/reviews/:reviewId': {
    path: '/reviews/:reviewId',
    name: 'Review',
    pagePermission: 'page.project.reviews',
    permissions: ['review.view'],
  },
  '/versions': {
    path: '/versions',
    name: 'Versions',
    pagePermission: 'page.project.versions',
    permissions: ['version.view'],
  },
  '/publishing': {
    path: '/publishing',
    name: 'Publishing',
    pagePermission: 'page.project.publishing',
    permissions: ['publishing.view'],
  },
  '/publishing/new': { path: '/publishing/new', name: 'Create Export Job', permissions: ['publishing.create'] },
  '/publishing/:id/edit': { path: '/publishing/:id/edit', name: 'Edit Export Job', permissions: ['publishing.update'] },
  '/publishing/:publishId': { path: '/publishing/:publishId', name: 'Export Job', pagePermission: 'page.project.publishing', permissions: ['publishing.view'] },
  '/publishing/files': { path: '/publishing/files', name: 'Published Files', permissions: ['publishing.view'] },
  '/publishing/files/new': { path: '/publishing/files/new', name: 'Register File', permissions: ['publishing.create'] },
  '/publishing/files/bulk': { path: '/publishing/files/bulk', name: 'Register Many Files', permissions: ['publishing.create'] },
  '/publishing/files/:fileId': { path: '/publishing/files/:fileId', name: 'Published File', permissions: ['publishing.view'] },
  '/publishing/storage-roots': { path: '/publishing/storage-roots', name: 'Storage Roots', permissions: ['publishing.view'] },
  '/publishing/storage-roots/new': { path: '/publishing/storage-roots/new', name: 'Create Storage Root', permissions: ['publishing.storage.manage'] },
  '/publishing/storage-roots/:id/edit': { path: '/publishing/storage-roots/:id/edit', name: 'Edit Storage Root', permissions: ['publishing.storage.manage'] },
  '/publishing/destinations': { path: '/publishing/destinations', name: 'Publish Destinations', permissions: ['publishing.view'] },
  '/publishing/destinations/new': { path: '/publishing/destinations/new', name: 'Create Publish Destination', permissions: ['publishing.create'] },
  '/publishing/destinations/:id/edit': { path: '/publishing/destinations/:id/edit', name: 'Edit Publish Destination', permissions: ['publishing.update'] },
  '/deliveries': {
    path: '/deliveries',
    name: 'Deliveries',
    pagePermission: 'page.project.deliveries',
    permissions: ['delivery.view'],
  },
  '/reviews': {
    path: '/reviews',
    name: 'Reviews',
    pagePermission: 'page.project.reviews',
    permissions: ['review.view'],
  },
  '/workflows': {
    path: '/workflows',
    name: 'Workflows',
    pagePermission: 'page.project.workflow',
    permissions: ['workflow.view'],
  },
  '/scheduling': {
    path: '/scheduling',
    name: 'Scheduling',
    pagePermission: 'page.project.schedule',
    permissions: ['schedule.view'],
  },
  '/calendar': {
    path: '/calendar',
    name: 'Calendar',
    pagePermission: 'page.project.schedule',
    permissions: ['schedule.view'],
  },
  // Flat entity detail routes (ADR-0033 D1: membership checks on nested
  // project routes are stronger; flat routes enforce the project boundary +
  // page/entity view codes).
  '/shots/:shotId': {
    path: '/shots/:shotId',
    name: 'Shot Detail',
    pagePermission: 'page.project.shots',
    permissions: ['shot.view'],
  },
  '/shots/:shotId/:tab': {
    path: '/shots/:shotId/:tab',
    name: 'Shot Detail Tab',
    pagePermission: 'page.project.shots',
    permissions: ['shot.view'],
  },
  '/assets/:assetId': {
    path: '/assets/:assetId',
    name: 'Asset Detail',
    pagePermission: 'page.project.assets',
    permissions: ['asset.view'],
  },
  '/assets/:assetId/:tab': {
    path: '/assets/:assetId/:tab',
    name: 'Asset Detail Tab',
    pagePermission: 'page.project.assets',
    permissions: ['asset.view'],
  },
  '/tasks/:taskId': {
    path: '/tasks/:taskId',
    name: 'Task Detail',
    pagePermission: 'page.project.tasks',
    permissions: ['task.view'],
  },
  '/versions/:versionId': {
    path: '/versions/:versionId',
    name: 'Version Detail',
    pagePermission: 'page.project.versions',
    permissions: ['version.view'],
  },
  '/deliveries/:deliveryId': {
    path: '/deliveries/:deliveryId',
    name: 'Delivery Detail',
    pagePermission: 'page.project.deliveries',
    permissions: ['delivery.view'],
  },
  '/deliveries/new': { path: '/deliveries/new', name: 'Create Delivery', permissions: ['delivery.create'] },
  '/deliveries/:id/edit': { path: '/deliveries/:id/edit', name: 'Edit Delivery', permissions: ['delivery.update'] },
  '/deliveries/destinations': { path: '/deliveries/destinations', name: 'Delivery Destinations', permissions: ['delivery.view'] },
  '/deliveries/destinations/new': { path: '/deliveries/destinations/new', name: 'Create Destination', permissions: ['delivery.create'] },
  '/deliveries/destinations/:id/edit': { path: '/deliveries/destinations/:id/edit', name: 'Edit Destination', permissions: ['delivery.update'] },
  '/shows/:showId': {
    path: '/shows/:showId',
    name: 'Show Workspace',
    pagePermission: 'page.project.overview',
    permissions: ['show.view'],
  },

  // Platform Routes
  // /settings only redirects to My account; system settings get their own guarded routes in Phase 11.
  '/settings': {
    path: '/settings',
    name: 'Settings',
    pagePermission: 'page.account',
  },
  '/settings/permissions': {
    path: '/settings/permissions',
    name: 'Roles & Permissions',
    pagePermission: 'page.permissions',
    permissions: ['roles.view'],
  },
  '/settings/roles': {
    path: '/settings/roles',
    name: 'Role Management',
    pagePermission: 'page.permissions',
    permissions: ['roles.view'],
  },
  '/permissions': {
    path: '/permissions',
    name: 'Roles & Permissions',
    pagePermission: 'page.permissions',
    permissions: ['roles.view'],
  },
  '/platform/health': {
    path: '/platform/health',
    name: 'API Health',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view'],
  },
  '/api-health': {
    path: '/api-health',
    name: 'API Health (alias)',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view'],
  },
  '/system-logs': {
    path: '/system-logs',
    name: 'System Logs',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view', 'audit.view'],
    requireAny: true,
  },
  '/platform/admin': {
    path: '/platform/admin',
    name: 'Platform Administration',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view'],
  },
  '/platform/admin/:tab': {
    path: '/platform/admin/:tab',
    name: 'Platform Administration Tab',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view'],
  },
  '/platform/admin/pipeline': {
    path: '/platform/admin/pipeline',
    name: 'Pipeline & Color Settings',
    pagePermission: 'page.settings',
    permissions: ['settings.view'],
  },
  '/platform/admin/theme': {
    path: '/platform/admin/theme',
    name: 'Theme Settings',
    pagePermission: 'page.settings',
    permissions: ['settings.view'],
  },
  '/platform/admin/layout': {
    path: '/platform/admin/layout',
    name: 'Page Layout Settings',
    pagePermission: 'page.settings',
    permissions: ['settings.view'],
  },
  '/platform/admin/overview': {
    path: '/platform/admin/overview',
    name: 'Platform Overview',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view'],
  },
  '/platform/admin/master-data': {
    path: '/platform/admin/master-data',
    name: 'Master Data',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.master_data.view'],
  },
  '/platform/admin/software': {
    path: '/platform/admin/software',
    name: 'Software / DCC',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.software.view', 'platform.master_data.view'],
  },
  '/platform/admin/statuses': {
    path: '/platform/admin/statuses',
    name: 'Statuses',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.status.view', 'platform.master_data.view'],
  },
  '/platform/admin/roles': {
    path: '/platform/admin/roles',
    name: 'Platform Roles',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view', 'roles.view'],
  },
  '/platform/admin/groups': {
    path: '/platform/admin/groups',
    name: 'Platform Groups',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view', 'group.view'],
  },
  '/platform/admin/departments': {
    path: '/platform/admin/departments',
    name: 'Platform Departments',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view', 'department.view'],
  },
  '/platform/admin/positions': {
    path: '/platform/admin/positions',
    name: 'Platform Positions',
    pagePermission: 'page.platform_admin',
    permissions: ['platform.admin.view', 'platform.position.view'],
  },
  '/platform/admin/task-types': {
    path: '/platform/admin/task-types',
    name: 'Platform Task Types',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.task_type.view', 'platform.master_data.view'],
  },
  '/platform/admin/asset-types': {
    path: '/platform/admin/asset-types',
    name: 'Platform Asset Types',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.asset_type.view', 'platform.master_data.view'],
  },
  '/platform/admin/shot-types': {
    path: '/platform/admin/shot-types',
    name: 'Platform Shot Types',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.shot_type.view', 'platform.master_data.view'],
  },
  '/platform/admin/review-types': {
    path: '/platform/admin/review-types',
    name: 'Platform Review Types',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.review_type.view', 'platform.master_data.view'],
  },
  '/platform/admin/file-types': {
    path: '/platform/admin/file-types',
    name: 'Platform File Types',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.admin.view', 'platform.file_type.view', 'platform.master_data.view'],
  },
  '/platform/master-data': {
    path: '/platform/master-data',
    name: 'Global Master Data',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.master_data.view', 'platform.admin.view'],
  },
  '/platform/master-data/:tab': {
    path: '/platform/master-data/:tab',
    name: 'Global Master Data Tab',
    pagePermission: 'page.platform_master_data',
    permissions: ['platform.master_data.view', 'platform.admin.view'],
  },
  '/audit': {
    path: '/audit',
    name: 'Audit Logs',
    permissions: ['audit.view', 'page.audit', 'page.audit_logs'],
    requireAny: true,
  },
  '/audit-logs': {
    path: '/audit-logs',
    name: 'Audit Logs (alias)',
    permissions: ['audit.view', 'page.audit', 'page.audit_logs'],
    requireAny: true,
  },
  '/api-requests': {
    path: '/api-requests',
    name: 'API Requests',
    permissions: ['api_requests.view', 'page.api_requests', 'audit.view'],
    requireAny: true,
  },
  '/jobs': {
    path: '/jobs',
    name: 'Background Jobs',
    permissions: ['background_jobs.view', 'page.background_jobs', 'page.jobs', 'audit.view'],
    requireAny: true,
  },
  '/background-jobs': {
    path: '/background-jobs',
    name: 'Background Jobs (alias)',
    permissions: ['background_jobs.view', 'page.background_jobs', 'page.jobs', 'audit.view'],
    requireAny: true,
  },
  '/change-logs': {
    path: '/change-logs',
    name: 'Change Logs',
    permissions: ['change_logs.view', 'page.change_logs', 'audit.view'],
    requireAny: true,
  },
  '/error-logs': {
    path: '/error-logs',
    name: 'Error Logs',
    permissions: ['error_logs.view', 'page.error_logs', 'audit.view'],
    requireAny: true,
  },
  '/login-history': {
    path: '/login-history',
    name: 'Login History',
    permissions: ['login_history.view', 'page.login_history', 'audit.view'],
    requireAny: true,
  },
  '/tracks': {
    path: '/tracks',
    name: 'Editorial & Telemetry Tracks',
    permissions: ['tracks.view', 'track.view', 'editorial_track.view', 'page.tracks', 'audit.view'],
    requireAny: true,
  },
  '/activity': {
    path: '/activity',
    name: 'Activity Timeline',
    permissions: ['activity.view', 'activities.view', 'page.activities', 'page.activity', 'audit.view'],
    requireAny: true,
  },
  '/activities': {
    path: '/activities',
    name: 'Activity Timeline (alias)',
    permissions: ['activity.view', 'activities.view', 'page.activities', 'page.activity', 'audit.view'],
    requireAny: true,
  },
};

/**
 * Project Workspace Tab Permission Registry
 */

// -----------------------------------------------------------------------------
// Nested project/show detail matrix (ADR-0033 D2): every deep project/show
// route carries the project boundary + the entity view code. Generated to
// keep the literal registry focused on the leaf semantics.
// -----------------------------------------------------------------------------

const NESTED_PROJECT_BASES = [
  "/projects",
] as const;

const ENTITY_DETAIL_PAGES: Array<
  [string, string, string] // [segment, pagePermission, permission]
> = [
  ["assets", "page.project.assets", "asset.view"],
  ["shots", "page.project.shots", "shot.view"],
  ["shows", "page.project.overview", "show.view"],
  ["tasks", "page.project.tasks", "task.view"],
  ["versions", "page.project.versions", "version.view"],
  ["reviews", "page.project.reviews", "review.view"],
];

const nestedEntries: Record<string, RoutePermissionMetadata> = {};

for (const base of NESTED_PROJECT_BASES) {
  const projectParam = ":projectId";
  // project tab + assets list + edit
  nestedEntries[`${base}/${projectParam}/:tab`.replace(`${base}/${projectParam}`, `${base}/${projectParam}`)] = {
    path: `${base}/${projectParam}/:tab`,
    name: "Project Tab",
    pagePermission: "page.project.overview",
    permissions: ["project.view"],
    requiresProjectMembership: true,
  };
  nestedEntries[`${base}/${projectParam}/edit`] = {
    path: `${base}/${projectParam}/edit`,
    name: "Edit Project",
    permissions: ["project.update"],
    requiresProjectMembership: true,
  };
  nestedEntries[`${base}/${projectParam}/assets`] = {
    path: `${base}/${projectParam}/assets`,
    name: "Project Assets",
    pagePermission: "page.project.assets",
    permissions: ["asset.view"],
    requiresProjectMembership: true,
  };
  for (const [segment, pagePermission, permission] of ENTITY_DETAIL_PAGES) {
    const idParam =
      segment === "shows"
        ? ":showId"
        : segment === "shots"
          ? ":shotId"
          : segment === "assets"
            ? ":assetId"
            : segment === "tasks"
              ? ":taskId"
              : segment === "versions"
                ? ":versionId"
                : ":id";
    nestedEntries[`${base}/${projectParam}/${segment}/${idParam}`] = {
      path: `${base}/${projectParam}/${segment}/${idParam}`,
      name: `Project ${segment} detail`,
      pagePermission,
      permissions: [permission],
      requiresProjectMembership: true,
    };
    nestedEntries[`${base}/${projectParam}/${segment}/${idParam}/:tab`] = {
      path: `${base}/${projectParam}/${segment}/${idParam}/:tab`,
      name: `Project ${segment} detail tab`,
      pagePermission,
      permissions: [permission],
      requiresProjectMembership: true,
    };
    // Show-level entity lists AND details inside shows
    if (segment !== "shows") {
      nestedEntries[`${base}/${projectParam}/shows/:showId/${segment}`] = {
        path: `${base}/${projectParam}/shows/:showId/${segment}`,
        name: `Show ${segment}`,
        pagePermission,
        permissions: [permission],
        requiresProjectMembership: true,
      };
      nestedEntries[`${base}/${projectParam}/shows/:showId/${segment}/${idParam}`] = {
        path: `${base}/${projectParam}/shows/:showId/${segment}/${idParam}`,
        name: `Show ${segment} detail`,
        pagePermission,
        permissions: [permission],
        requiresProjectMembership: true,
      };
    }
  }
}

Object.assign(ROUTE_PERMISSIONS_REGISTRY, nestedEntries);

export const PROJECT_TAB_PERMISSIONS: Record<
  string,
  {
    pagePermission: string;
    permissions: string[];
    scope?: string;
  }
> = {
  overview: {
    pagePermission: 'page.project.overview',
    permissions: ['project.view'],
  },
  editorial: {
    pagePermission: 'page.project.editorial',
    permissions: ['editorial.view', 'sequence.view'],
  },
  episodes: {
    pagePermission: 'page.project.episodes',
    permissions: ['episode.view'],
  },
  sequences: {
    pagePermission: 'page.project.sequences',
    permissions: ['sequence.view'],
  },
  shots: {
    pagePermission: 'page.project.shots',
    permissions: ['shot.view'],
  },
  assets: {
    pagePermission: 'page.project.assets',
    permissions: ['asset.view'],
  },
  tasks: {
    pagePermission: 'page.project.tasks',
    permissions: ['task.view'],
  },
  versions: {
    pagePermission: 'page.project.versions',
    permissions: ['version.view'],
  },
  reviews: {
    pagePermission: 'page.project.reviews',
    permissions: ['review.view'],
  },
  notes: {
    pagePermission: 'page.project.notes',
    permissions: ['note.view', 'task.view'],
  },
  deliveries: {
    pagePermission: 'page.project.deliveries',
    permissions: ['delivery.view'],
  },
  schedule: {
    pagePermission: 'page.project.schedule',
    permissions: ['schedule.view'],
  },
  resources: {
    pagePermission: 'page.project.resources',
    permissions: ['resource.view', 'people.view'],
  },
  pipeline: {
    pagePermission: 'page.project.pipeline',
    permissions: ['pipeline.view', 'settings.view'],
  },
  files: {
    pagePermission: 'page.project.files',
    permissions: ['file.view', 'version.view'],
  },
  activity: {
    pagePermission: 'page.project.activity',
    permissions: ['audit.view'],
  },
  tracks: {
    pagePermission: 'page.project.tracks',
    permissions: ['editorial_track.view', 'track.view', 'editorial.view'],
  },
  publishing: {
    pagePermission: 'page.project.publishing',
    permissions: ['version.create', 'version.view'],
  },
  playlists: {
    pagePermission: 'page.project.playlists',
    permissions: ['review.view'],
  },
  workflow: {
    pagePermission: 'page.project.workflow',
    permissions: ['workflow.view'],
  },
  timelogs: {
    pagePermission: 'page.project.timelogs',
    permissions: ['timelog.view'],
  },
  calendar: {
    pagePermission: 'page.project.calendar',
    permissions: ['schedule.view'],
  },
  attachments: {
    pagePermission: 'page.project.attachments',
    permissions: ['file.view'],
  },
};

/**
 * Extracts parameter values from a pathname given a route pattern (e.g. /projects/:id)
 */
export function extractRouteParams(pattern: string, pathname: string): Record<string, string> {
  const paramNames: string[] = [];
  const regexStr =
    '^' +
    pattern.replace(/:([^\s/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    }) +
    '$';
  const regex = new RegExp(regexStr);
  const match = pathname.match(regex);
  if (!match) return {};
  const params: Record<string, string> = {};
  paramNames.forEach((name, idx) => {
    params[name] = match[idx + 1];
  });
  return params;
}

/**
 * Resolves route permission metadata by static match or parameterized regex match
 */
export function matchRouteMetadata(pathname: string): RoutePermissionMetadata | undefined {
  if (ROUTE_PERMISSIONS_REGISTRY[pathname]) {
    return ROUTE_PERMISSIONS_REGISTRY[pathname];
  }
  return Object.values(ROUTE_PERMISSIONS_REGISTRY).find((r) => {
    if (r.path === pathname) return true;
    if (r.path.includes(':')) {
      const regex = new RegExp('^' + r.path.replace(/:[^\s/]+/g, '([^/]+)') + '$');
      return regex.test(pathname);
    }
    return false;
  });
}

export function getRoutePermissionMetadata(pathname: string): RoutePermissionMetadata | undefined {
  return matchRouteMetadata(pathname);
}

/**
 * Evaluates route access for a user in a given project context
 */
export function evaluateRouteAccess(
  user: User | null,
  pathname: string,
  context?: PermissionEvaluationContext
): {
  allowed: boolean;
  reason?:
    | 'not_authenticated'
    | 'no_project_membership'
    | 'forbidden_page'
    | 'forbidden_permission'
    | 'client_forbidden_route'
    | 'vendor_forbidden_route'
    | string;
  requiredPermission?: string;
} {
  if (!user) {
    return { allowed: false, reason: 'not_authenticated' };
  }

  // Platform break-glass bypass (strict superuser-only)
  if (isBreakGlass(user)) {
    return { allowed: true };
  }

  // External Direct URL Restrictions
  const membershipType = getUserMembershipType(user);
  const normalizedPath = pathname.toLowerCase();

  if (membershipType === 'CLIENT') {
    const clientForbiddenRoutes = [
      '/settings',
      '/people',
      '/departments',
      '/teams',
      '/offices',
      '/clients',
      '/vendors',
      '/pipeline',
      '/audit',
      '/resources',
      '/schedules',
    ];
    if (clientForbiddenRoutes.some((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`))) {
      return {
        allowed: false,
        reason: 'client_forbidden_route',
      };
    }
  }

  if (membershipType === 'VENDOR') {
    const vendorForbiddenRoutes = [
      '/settings',
      '/people',
      '/departments',
      '/offices',
      '/clients',
      '/audit',
    ];
    if (vendorForbiddenRoutes.some((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`))) {
      return {
        allowed: false,
        reason: 'vendor_forbidden_route',
      };
    }
  }

  // Match Route Metadata
  const routeMeta = matchRouteMetadata(pathname);
  const extractedParams = routeMeta?.path ? extractRouteParams(routeMeta.path, pathname) : {};

  const extractedProjectId =
    extractedParams.projectId ||
    (routeMeta?.path.includes('/projects/') || routeMeta?.path.includes('/shows/')
      ? extractedParams.id || extractedParams.showId
      : undefined);

  const projectId = context?.projectId || extractedProjectId;

  // 1. Project Access
  if ((routeMeta?.requiresProjectMembership || projectId) && projectId) {
    if (!checkUserHasProjectAccess(user, projectId)) {
      return { allowed: false, reason: 'no_project_membership' };
    }
  }

  const evalContext: PermissionEvaluationContext = {
    projectId: projectId,
    ...context,
  };

  // 2. Page Permission Check
  if (routeMeta?.pagePermission) {
    const hasPage = evaluateUserPermission(user, routeMeta.pagePermission, evalContext);
    if (!hasPage) {
      return {
        allowed: false,
        reason: 'forbidden_page',
        requiredPermission: routeMeta.pagePermission,
      };
    }
  }

  // 3. Resource Permission(s) Check
  if (routeMeta?.permissions && routeMeta.permissions.length > 0) {
    const hasResource = routeMeta.requireAny
      ? routeMeta.permissions.some((p) => evaluateUserPermission(user, p, evalContext))
      : routeMeta.permissions.every((p) => evaluateUserPermission(user, p, evalContext));

    if (!hasResource) {
      return {
        allowed: false,
        reason: 'forbidden_permission',
        requiredPermission: routeMeta.permissions[0],
      };
    }
  }

  return { allowed: true };
}

export const isRouteAllowed = evaluateRouteAccess;
export const checkRouteAccess = (
  routeMetaOrPath: any,
  user: User | null,
  projectId?: string
) => {
  const path =
    typeof routeMetaOrPath === 'string'
      ? routeMetaOrPath
      : routeMetaOrPath?.path || '';
  return evaluateRouteAccess(user, path, { projectId });
};

/**
 * Helper to check if a specific project tab is accessible for the user
 */
export function isProjectTabAllowed(
  user: User | null,
  tabId: string,
  context: { projectId: string }
): boolean {
  if (!user) return false;
  if (isBreakGlass(user)) {
    return true;
  }

  // Ensure user has base project access first
  if (!checkUserHasProjectAccess(user, context.projectId)) {
    return false;
  }

  // Client user tab restrictions
  const membershipType = getUserMembershipType(user);
  if (membershipType === 'CLIENT') {
    const clientBannedTabs = [
      'tasks',
      'notes',
      'schedule',
      'resources',
      'pipeline',
      'workflow',
      'timelogs',
      'publishing',
      'activity',
    ];
    if (clientBannedTabs.includes(tabId)) {
      return false;
    }
  }

  // Vendor user tab restrictions
  if (membershipType === 'VENDOR') {
    const vendorBannedTabs = ['pipeline', 'resources', 'workflow'];
    if (vendorBannedTabs.includes(tabId)) {
      return false;
    }
  }

  const tabMeta = PROJECT_TAB_PERMISSIONS[tabId];
  if (!tabMeta) {
    // Default tabs like overview are allowed if project access granted
    return true;
  }

  const evalContext: PermissionEvaluationContext = {
    projectId: context.projectId,
  };

  // Check page permission
  if (tabMeta.pagePermission) {
    const canPage = evaluateUserPermission(user, tabMeta.pagePermission, evalContext);
    if (canPage) return true;
  }

  // Check resource permissions
  if (tabMeta.permissions && tabMeta.permissions.length > 0) {
    const canResource = tabMeta.permissions.some((p) =>
      evaluateUserPermission(user, p, evalContext)
    );
    if (canResource) return true;
  }

  return false;
}
