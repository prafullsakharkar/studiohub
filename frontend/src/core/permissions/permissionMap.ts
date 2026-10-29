/**
 * Legacy frontend permission code -> what the backend actually enforces.
 *
 * The frontend grew its own vocabulary (`people.create`, `platform.software.update`,
 * `page.project.shots`, ...). Only `user.permissions` from `/auth/me/` is real, and it holds backend
 * codes. Every legacy code used as a gate is translated here, with the evidence for each decision
 * (docs/sync/00-backend-inventory.md, permission_map of the owning viewset).
 *
 * Three kinds of rule:
 *  - `codes`    the backend requires these (`all` = every one, `any` = at least one).
 *  - `open`     the backend only requires a signed-in user; the UI must not invent a stricter gate.
 *  - `unbacked` the backend has no capability behind this control (no endpoint). It is always
 *               denied so a button that cannot work is not shown; the owning phase decides whether
 *               to build it, ask for a backend change, or delete the control.
 *
 * Codes that are already backend codes need no entry. Anything else fails closed.
 */

export type PermissionRule =
  | { kind: 'codes'; any?: readonly string[]; all?: readonly string[]; why: string }
  | { kind: 'open'; why: string }
  | { kind: 'unbacked'; why: string };

const codes = (why: string, ...all: string[]): PermissionRule => ({ kind: 'codes', all, why });
const anyOf = (why: string, ...any: string[]): PermissionRule => ({ kind: 'codes', any, why });
const open = (why: string): PermissionRule => ({ kind: 'open', why });
const unbacked = (why: string): PermissionRule => ({ kind: 'unbacked', why });

const DIRECTORY_READ = 'Directory list/retrieve are authenticated-only (DepartmentViewSet etc. permission_map).';
const DIRECTORY_WRITE = 'Every directory write needs masterdata.directory.manage (create/update/destroy).';
/** An administration *screen* is offered to those who can change what it edits, even though the read endpoints behind it are open (every user's dropdowns need them). */
const catalogAdminScreen = (): PermissionRule =>
  codes('Platform Admin screen: offered to catalog managers; the read endpoints themselves are open.', 'masterdata.catalog.manage');
const rbacAdminScreen = (): PermissionRule =>
  anyOf('Access workspace: offered to those who can change roles, groups or permissions; the RBAC list endpoints are open.', 'identity.role.update', 'identity.group.update', 'identity.permission.update');
const CATALOG_WRITE = 'Catalog writes incl. archive/restore/reorder need masterdata.catalog.manage.';
const AUDIT_READ = 'All audit ledger list/retrieve need audit.view.';
const NO_BACKEND_GATE = 'The backend returns this field to anyone who can read the record; it has no field gate.';
const REMOVED = 'Feature removed in docs/sync Q2 (no backend module).';

/** Project tab visibility = the read permission of the data that tab lists. */
const projectTab = (why: string, ...any: string[]): PermissionRule => anyOf(`Project tab: ${why}`, ...any);

export const PERMISSION_MAP: Readonly<Record<string, PermissionRule>> = {
  // --- Directory (departments, teams, offices, positions, people, clients, vendors) ---
  'department.view': open(DIRECTORY_READ),
  'team.view': open(DIRECTORY_READ),
  'office.view': open(DIRECTORY_READ),
  'people.view': open(DIRECTORY_READ),
  'client.view': open(DIRECTORY_READ),
  'vendor.view': open(DIRECTORY_READ),
  'platform.position.view': open(DIRECTORY_READ),
  ...Object.fromEntries(
    [
      'department.create', 'department.update', 'team.create', 'team.update', 'office.create', 'office.update',
      'people.create', 'people.update', 'people.delete', 'person.create', 'person.archive', 'person.restore',
      'person.delete', 'client.create', 'client.update', 'vendor.create', 'vendor.update',
    ].map((code) => [code, codes(DIRECTORY_WRITE, 'masterdata.directory.manage')])
  ),

  // --- Platform master-data catalog ---
  'platform.admin.view': catalogAdminScreen(),
  'platform.master_data.view': catalogAdminScreen(),
  'platform.asset_type.view': catalogAdminScreen(),
  'platform.file_type.view': catalogAdminScreen(),
  'platform.review_type.view': catalogAdminScreen(),
  'platform.shot_type.view': catalogAdminScreen(),
  'platform.task_type.view': catalogAdminScreen(),
  'platform.software.view': catalogAdminScreen(),
  'platform.status.view': catalogAdminScreen(),
  ...Object.fromEntries(
    [
      'platform.admin.manage',
      ...['master_data', 'asset_type', 'file_type', 'review_type', 'shot_type', 'task_type', 'software', 'software_version', 'status'].flatMap(
        (resource) => ['create', 'update', 'archive', 'restore', 'delete'].map((action) => `platform.${resource}.${action}`)
      ),
    ].map((code) => [code, codes(CATALOG_WRITE, 'masterdata.catalog.manage')])
  ),

  // --- Audit, security and job ledgers ---
  'activity.view': codes(AUDIT_READ, 'audit.view'),
  'activities.view': codes(AUDIT_READ, 'audit.view'),
  'api_requests.view': codes(AUDIT_READ, 'audit.view'),
  'background_jobs.view': codes(AUDIT_READ, 'audit.view'),
  'change_logs.view': codes(AUDIT_READ, 'audit.view'),
  'error_logs.view': codes(AUDIT_READ, 'audit.view'),
  'tracks.view': codes(AUDIT_READ, 'audit.view'),
  'login_history.view': codes('LoginHistoryViewSet needs identity.login_history.view (not seeded, CR-02).', 'identity.login_history.view'),
  'security.view': codes('SecurityEventViewSet needs identity.security_event.view (not seeded, CR-02).', 'identity.security_event.view'),

  // --- Access control (RBAC lists are open; writes are identity.*) ---
  'group.view': rbacAdminScreen(),
  'roles.view': rbacAdminScreen(),
  'page.permissions': rbacAdminScreen(),
  'roles.create': codes('RoleViewSet.create', 'identity.role.create'),
  'roles.manage': codes('RoleViewSet.update/permissions/users/groups', 'identity.role.update'),
  'permissions.manage': codes('PermissionViewSet.update', 'identity.permission.update'),
  'security.manage': anyOf('No dedicated security-admin permission exists; closest are the role/permission writers.', 'identity.role.update', 'identity.permission.update'),

  // --- Settings ---
  'settings.update': codes('SystemSettingViewSet writes are gated by settings.manage; settings.update is seeded but enforced nowhere.', 'settings.manage'),
  'page.settings': codes('Settings reads need settings.view (enforced, not seeded: CR-02).', 'settings.view'),

  // --- Production actions ---
  'asset.archive': codes('AssetViewSet.archive/bulk_archive need asset.delete.', 'asset.delete'),
  'asset.approve': unbacked('AssetViewSet has no approve action.'),
  'asset.assign': unbacked('AssetViewSet has no assign action.'),
  'shot.archive': codes('ShotViewSet.archive/bulk_archive need shot.delete.', 'shot.delete'),
  'shot.restore': codes('ShotViewSet.restore needs shot.update.', 'shot.update'),
  'shot.assign': unbacked('ShotViewSet has no assign action.'),
  'episode.archive': codes('EpisodeViewSet.archive needs episode.delete.', 'episode.delete'),
  'episode.restore': codes('EpisodeViewSet.restore needs episode.update.', 'episode.update'),
  'task.assign': codes('TaskViewSet.bulk_assign needs task.update.', 'task.update'),
  'task.approve': unbacked('TaskViewSet has no approve action (timelog.approve is for timelogs).'),
  'project.archive': codes('ProjectViewSet.destroy (soft delete) needs project.delete.', 'project.delete'),
  'review.manage': codes('ReviewViewSet state transitions need review.update.', 'review.update'),
  'review.status': codes('ReviewViewSet.submit/start_review/close need review.update.', 'review.update'),
  'review.submit': codes('ReviewViewSet.submit needs review.update.', 'review.update'),
  'review.close': codes('ReviewViewSet.close needs review.update.', 'review.update'),
  'review.comment': codes('ReviewViewSet.comments needs review.update.', 'review.update'),
  'review.reopen': codes('ReviewViewSet.reopen_comment needs review.update.', 'review.update'),
  'review.action': codes('Verdicts (approve/reject/request_changes) need review.approve.', 'review.approve'),
  'review.reject': codes('ReviewViewSet.reject needs review.approve.', 'review.approve'),
  'review.request_changes': codes('ReviewViewSet.request_changes needs review.approve.', 'review.approve'),
  'shot.submit': codes('Status moves are plain updates (ShotViewSet has no submit action).', 'shot.update'),
  'shot.reopen': codes('Status moves are plain updates (ShotViewSet has no reopen action).', 'shot.update'),
  'task.start': codes('Status moves are plain updates (TaskViewSet has no start action).', 'task.update'),
  'task.pause': codes('Status moves are plain updates.', 'task.update'),
  'task.complete': codes('Status moves are plain updates.', 'task.update'),
  'task.reject': codes('Status moves are plain updates.', 'task.update'),
  'task.bulk_update': codes('TaskViewSet.bulk_update needs task.update.', 'task.update'),
  'version.submit': codes('Status moves are plain updates (VersionViewSet has no submit action).', 'version.update'),
  'version.withdraw': codes('Status moves are plain updates.', 'version.update'),
  'version.supersede': codes('Status moves are plain updates.', 'version.update'),
  'delivery.submit': codes('DeliveryViewSet.submit needs delivery.send.', 'delivery.send'),
  'delivery.reject': codes('DeliveryViewSet.reject needs delivery.send.', 'delivery.send'),
  'delivery.cancel': codes('DeliveryViewSet.cancel needs delivery.update.', 'delivery.update'),
  'delivery.publish': anyOf('Completing a delivery is DeliveryViewSet.complete (delivery.update); publishing a file is publishing.create.', 'delivery.update', 'publishing.create'),

  // --- Project tabs (`page.project.*`): the read permission of what the tab lists ---
  // Audit/security page codes -> the ledger they list
  ...Object.fromEntries(
    ['activity', 'activities', 'audit', 'audit_logs', 'api_requests', 'background_jobs', 'jobs', 'change_logs', 'error_logs', 'tracks'].map(
      (page) => [`page.${page}`, codes(AUDIT_READ, 'audit.view')]
    )
  ),
  'page.login_history': codes('LoginHistoryViewSet needs identity.login_history.view (not seeded, CR-02).', 'identity.login_history.view'),

  'page.project.overview': open('Project membership is the only gate; summary/dashboard need project.view, checked by the API.'),
  'page.project.activity': projectTab('ProjectActivityView', 'audit.view'),
  'page.project.assets': projectTab('assets list', 'asset.view'),
  'page.project.attachments': open('Attachments are scoped to the uploader, not a permission.'),
  'page.project.calendar': projectTab('ProjectScheduleView', 'schedule.view'),
  'page.project.deliveries': projectTab('ProjectDeliveriesView', 'delivery.view'),
  'page.project.editorial': projectTab('ProjectEditorialView', 'track.view'),
  'page.project.episodes': projectTab('episodes list', 'episode.view'),
  'page.project.files': projectTab('ProjectFilesView', 'media.view'),
  'page.project.notes': projectTab('ProjectNotesView', 'project.view'),
  'page.project.pipeline': projectTab('ProjectPipelineView', 'project.view'),
  'page.project.playlists': projectTab('playlists list', 'playlist.view'),
  'page.project.publishing': projectTab('published files', 'publishing.view'),
  'page.project.resources': projectTab('ProjectResourcesView', 'task.view'),
  'page.project.reviews': projectTab('reviews list', 'review.view'),
  'page.project.schedule': projectTab('ProjectScheduleView', 'schedule.view'),
  'page.project.sequences': projectTab('sequences list', 'sequence.view'),
  'page.project.shots': projectTab('shots list', 'shot.view'),
  'page.project.tasks': projectTab('tasks list', 'task.view'),
  'page.project.timelogs': projectTab('timelogs list', 'timelog.view'),
  'page.project.tracks': projectTab('editorial tracks', 'track.view'),
  'page.project.versions': projectTab('versions list', 'version.view'),
  'page.project.workflow': projectTab('workflows list', 'workflow.view'),
  'file.view': codes('ProjectFilesView', 'media.view'),
  'note.view': codes('ProjectNotesView', 'project.view'),
  'pipeline.view': codes('ProjectPipelineView', 'project.view'),
  'editorial.view': codes('ProjectEditorialView', 'track.view'),
  'editorial_track.view': codes('EditorialTrackViewSet', 'track.view'),
  'resource.view': codes('Scheduling resources', 'schedule.view'),

  // --- Top-level pages ---
  'page.dashboard': open('Dashboard data is scoped by the API.'),
  'page.workspace': open('Shell page.'),
  'page.projects': codes('ProjectViewSet.list', 'project.view'),
  'page.people': open(DIRECTORY_READ),
  'page.clients': open(DIRECTORY_READ),
  'page.vendors': open(DIRECTORY_READ),
  'page.departments': open(DIRECTORY_READ),
  'page.offices': open(DIRECTORY_READ),
  'page.teams': open(DIRECTORY_READ),
  'page.platform_admin': catalogAdminScreen(),
  'page.platform_master_data': catalogAdminScreen(),

  // --- Removed features ---
  'reports.view': unbacked(REMOVED),
  'page.reports': unbacked(REMOVED),
  'page.notifications': unbacked(REMOVED),
  'page.data_platform': unbacked(REMOVED),
  'testing.view': unbacked('In-app QA runner removed in Phase 1.'),

  // --- Field-level gates ---
  'field.artist.rate.view': codes('Rates are gated by schedule.view_rates.', 'schedule.view_rates'),
  'field.people.compensation.view': codes('PersonSerializer gates sensitive fields.', 'masterdata.person.view_sensitive'),
  'field.client.contract_value.view': codes('Financial fields are gated.', 'masterdata.client.view_financial'),
  'field.vendor.rate.view': codes('Financial fields are gated.', 'masterdata.client.view_financial'),
  'field.project.budget.view': open(NO_BACKEND_GATE),
  'field.project.budget.edit': codes('Editing a project needs project.update.', 'project.update'),
  'field.project.billing.view': open(NO_BACKEND_GATE),
  'field.project.billing.edit': codes('Editing a project needs project.update.', 'project.update'),
  'field.task.cost.view': open(NO_BACKEND_GATE),
  'field.task.cost.edit': codes('Editing a task needs task.update.', 'task.update'),
};
