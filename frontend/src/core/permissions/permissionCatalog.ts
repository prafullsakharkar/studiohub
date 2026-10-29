import { Permission } from '@/types/identity';

/**
 * Canonical StudioHub Enterprise Permission Catalog
 * Format: resource.action or page.route
 */
export const PERMISSION_CATALOG: Permission[] = [
  // ==========================================
  // 1. PAGE / NAVIGATION PERMISSIONS
  // ==========================================
  {
    id: 'perm-p-dash',
    code: 'page.dashboard',
    name: 'Dashboard Access',
    description: 'Access the executive and artist studio dashboard',
    resource: 'page',
    action: 'dashboard',
    category: 'page',
  },
  {
    id: 'perm-p-work',
    code: 'page.workspace',
    name: 'Personal Workspace Access',
    description: 'Access personal workspace and assigned task lists',
    resource: 'page',
    action: 'workspace',
    category: 'page',
  },
  {
    id: 'perm-p-people',
    code: 'page.people',
    name: 'People View',
    description: 'Access studio crew roster and profiles',
    resource: 'page',
    action: 'people',
    category: 'page',
  },
  {
    id: 'perm-p-dept',
    code: 'page.departments',
    name: 'Departments View',
    description: 'Access studio departments and craft structures',
    resource: 'page',
    action: 'departments',
    category: 'page',
  },
  {
    id: 'perm-p-teams',
    code: 'page.teams',
    name: 'Teams View',
    description: 'Access creative teams and unit rosters',
    resource: 'page',
    action: 'teams',
    category: 'page',
  },
  {
    id: 'perm-p-offices',
    code: 'page.offices',
    name: 'Offices View',
    description: 'Access facility offices and site stages',
    resource: 'page',
    action: 'offices',
    category: 'page',
  },
  {
    id: 'perm-p-clients',
    code: 'page.clients',
    name: 'Clients View',
    description: 'Access client accounts and partner portals',
    resource: 'page',
    action: 'clients',
    category: 'page',
  },
  {
    id: 'perm-p-vendors',
    code: 'page.vendors',
    name: 'Vendors View',
    description: 'Access external vendor studios and outsourcing contracts',
    resource: 'page',
    action: 'vendors',
    category: 'page',
  },
  {
    id: 'perm-p-projects',
    code: 'page.projects',
    name: 'Projects View',
    description: 'Access master project slate and productions',
    resource: 'page',
    action: 'projects',
    category: 'page',
  },

  // Project Tab Navigation Pages
  {
    id: 'perm-p-proj-overview',
    code: 'page.project.overview',
    name: 'Project Overview Tab',
    description: 'Access project health overview and KPI summaries',
    resource: 'page.project',
    action: 'overview',
    category: 'page',
  },
  {
    id: 'perm-p-proj-editorial',
    code: 'page.project.editorial',
    name: 'Project Editorial Tab',
    description: 'Access project editorial cuts, conform timeline, and EDLs',
    resource: 'page.project',
    action: 'editorial',
    category: 'page',
  },
  {
    id: 'perm-p-proj-ep',
    code: 'page.project.episodes',
    name: 'Project Episodes Tab',
    description: 'Access episodic project episodes and breakdown',
    resource: 'page.project',
    action: 'episodes',
    category: 'page',
  },
  {
    id: 'perm-p-proj-seq',
    code: 'page.project.sequences',
    name: 'Project Sequences Tab',
    description: 'Access project sequences breakdown and milestones',
    resource: 'page.project',
    action: 'sequences',
    category: 'page',
  },
  {
    id: 'perm-p-proj-shots',
    code: 'page.project.shots',
    name: 'Project Shots Tab',
    description: 'Access project shots grid, statuses, and frames',
    resource: 'page.project',
    action: 'shots',
    category: 'page',
  },
  {
    id: 'perm-p-proj-assets',
    code: 'page.project.assets',
    name: 'Project Assets Tab',
    description: 'Access project digital asset catalog and builds',
    resource: 'page.project',
    action: 'assets',
    category: 'page',
  },
  {
    id: 'perm-p-proj-tasks',
    code: 'page.project.tasks',
    name: 'Project Tasks Tab',
    description: 'Access production tasks board and assignments',
    resource: 'page.project',
    action: 'tasks',
    category: 'page',
  },
  {
    id: 'perm-p-proj-ver',
    code: 'page.project.versions',
    name: 'Project Versions Tab',
    description: 'Access project published versions, renders, and media',
    resource: 'page.project',
    action: 'versions',
    category: 'page',
  },
  {
    id: 'perm-p-proj-rev',
    code: 'page.project.reviews',
    name: 'Project Reviews Tab',
    description: 'Access project review sessions and dailies screening rooms',
    resource: 'page.project',
    action: 'reviews',
    category: 'page',
  },
  {
    id: 'perm-p-proj-notes',
    code: 'page.project.notes',
    name: 'Project Notes Tab',
    description: 'Access project notes, supervisor feedback, and director briefs',
    resource: 'page.project',
    action: 'notes',
    category: 'page',
  },
  {
    id: 'perm-p-proj-del',
    code: 'page.project.deliveries',
    name: 'Project Deliveries Tab',
    description: 'Access project delivery packages and client turnovers',
    resource: 'page.project',
    action: 'deliveries',
    category: 'page',
  },
  {
    id: 'perm-p-proj-sched',
    code: 'page.project.schedule',
    name: 'Project Schedule Tab',
    description: 'Access project calendar Gantt, milestones, and deadlines',
    resource: 'page.project',
    action: 'schedule',
    category: 'page',
  },
  {
    id: 'perm-p-proj-res',
    code: 'page.project.resources',
    name: 'Project Resources Tab',
    description: 'Access project crew allocations and capacity planners',
    resource: 'page.project',
    action: 'resources',
    category: 'page',
  },
  {
    id: 'perm-p-proj-pipe',
    code: 'page.project.pipeline',
    name: 'Project Pipeline Tab',
    description: 'Access project OCIO, DCC tool plugins, and storage configs',
    resource: 'page.project',
    action: 'pipeline',
    category: 'page',
  },
  {
    id: 'perm-p-proj-files',
    code: 'page.project.files',
    name: 'Project Files Tab',
    description: 'Access project file repository and attachments',
    resource: 'page.project',
    action: 'files',
    category: 'page',
  },
  {
    id: 'perm-p-proj-activity',
    code: 'page.project.activity',
    name: 'Project Activity Tab',
    description: 'Access project activity timeline and change history',
    resource: 'page.project',
    action: 'activity',
    category: 'page',
  },
  {
    id: 'perm-p-proj-tracks',
    code: 'page.project.tracks',
    name: 'Project Tracks Tab',
    description: 'Access editorial and telemetry tracks within a project',
    resource: 'page.project',
    action: 'tracks',
    category: 'page',
  },
  {
    id: 'perm-p-proj-publishing',
    code: 'page.project.publishing',
    name: 'Project Publishing Tab',
    description: 'Access project publishing registry and promote tools',
    resource: 'page.project',
    action: 'publishing',
    category: 'page',
  },
  {
    id: 'perm-p-proj-playlists',
    code: 'page.project.playlists',
    name: 'Project Playlists Tab',
    description: 'Access screening reels and review playlists within a project',
    resource: 'page.project',
    action: 'playlists',
    category: 'page',
  },
  {
    id: 'perm-p-proj-workflow',
    code: 'page.project.workflow',
    name: 'Project Workflow Tab',
    description: 'Access project workflow automation and pipeline graphs',
    resource: 'page.project',
    action: 'workflow',
    category: 'page',
  },
  {
    id: 'perm-p-proj-timelogs',
    code: 'page.project.timelogs',
    name: 'Project Timelogs Tab',
    description: 'Access project time logs, labor actuals, and timesheets',
    resource: 'page.project',
    action: 'timelogs',
    category: 'page',
  },
  {
    id: 'perm-p-proj-calendar',
    code: 'page.project.calendar',
    name: 'Project Calendar Tab',
    description: 'Access project calendar and schedule events',
    resource: 'page.project',
    action: 'calendar',
    category: 'page',
  },
  {
    id: 'perm-p-proj-attachments',
    code: 'page.project.attachments',
    name: 'Project Attachments Tab',
    description: 'Access project attachments and shared files',
    resource: 'page.project',
    action: 'attachments',
    category: 'page',
  },

  // Platform Level Pages
  {
    id: 'perm-p-timelogs',
    code: 'page.timelogs',
    name: 'Timelogs Page',
    description: 'Access artist time logs, labor actuals, and timesheet approvals',
    resource: 'page',
    action: 'timelogs',
    category: 'page',
  },
  {
    id: 'perm-p-publishing',
    code: 'page.publishing',
    name: 'Publishing Page',
    description: 'Access asset publishing registry and USD layer promote tools',
    resource: 'page',
    action: 'publishing',
    category: 'page',
  },
  {
    id: 'perm-p-workflows',
    code: 'page.workflows',
    name: 'Workflows Page',
    description: 'Access pipeline automation graph and state machine rules',
    resource: 'page',
    action: 'workflows',
    category: 'page',
  },
  {
    id: 'perm-p-reports',
    code: 'page.reports',
    name: 'Reports Page',
    description: 'Access executive analytics, velocity, and burn-down reports',
    resource: 'page',
    action: 'reports',
    category: 'page',
  },
  {
    id: 'perm-p-settings',
    code: 'page.settings',
    name: 'Settings Page',
    description: 'Access platform security and tenancy settings',
    resource: 'page',
    action: 'settings',
    category: 'page',
  },
  {
    id: 'perm-p-audit',
    code: 'page.audit',
    name: 'Audit Page',
    description: 'Access security audit trail and compliance activity logs',
    resource: 'page',
    action: 'audit',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-auditlogs',
    code: 'page.audit_logs',
    name: 'Audit Logs Page (alias)',
    description: 'Alias of page.audit used by audit routes and navigation',
    resource: 'page',
    action: 'audit_logs',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-bgjobs',
    code: 'page.background_jobs',
    name: 'Background Jobs Page (alias)',
    description: 'Alias of page.jobs used by jobs routes and navigation',
    resource: 'page',
    action: 'background_jobs',
    category: 'page',
  },
  {
    id: 'perm-p-apireq',
    code: 'page.api_requests',
    name: 'API Requests Page',
    description: 'Inspect live API request logs and response metrics',
    resource: 'page',
    action: 'api_requests',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-activities',
    code: 'page.activities',
    name: 'Activities Stream Page',
    description: 'Inspect studio production activity stream',
    resource: 'page',
    action: 'activities',
    category: 'page',
  },
  {
    id: 'perm-p-jobs',
    code: 'page.jobs',
    name: 'Background Jobs Page',
    description: 'Inspect background jobs and render queues',
    resource: 'page',
    action: 'jobs',
    category: 'page',
  },
  {
    id: 'perm-p-changelogs',
    code: 'page.change_logs',
    name: 'Change Logs Page',
    description: 'Inspect entity change logs and field mutations',
    resource: 'page',
    action: 'change_logs',
    category: 'page',
  },
  {
    id: 'perm-p-errorlogs',
    code: 'page.error_logs',
    name: 'Error Logs Page',
    description: 'Inspect system error logs and exception stack traces',
    resource: 'page',
    action: 'error_logs',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-loginhistory',
    code: 'page.login_history',
    name: 'Login History Page',
    description: 'Inspect user authentication sessions and MFA events',
    resource: 'page',
    action: 'login_history',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-tracks',
    code: 'page.tracks',
    name: 'Editorial & Telemetry Tracks Page',
    description: 'Inspect timeline tracks and interaction telemetry',
    resource: 'page',
    action: 'tracks',
    category: 'page',
  },
  {
    id: 'perm-p-notifications',
    code: 'page.notifications',
    name: 'Notifications Access',
    description: 'Access notifications and activity feed',
    resource: 'page',
    action: 'notifications',
    category: 'page',
  },
  {
    id: 'perm-p-data-platform',
    code: 'page.data_platform',
    name: 'Data Platform Access',
    description: 'Access data platform and warehouse tools',
    resource: 'page',
    action: 'data_platform',
    category: 'page',
  },
  {
    id: 'perm-p-activity',
    code: 'page.activity',
    name: 'Activity Access',
    description: 'Access global activity timeline and audit activity',
    resource: 'page',
    action: 'activity',
    category: 'page',
  },
  {
    id: 'perm-p-permissions',
    code: 'page.permissions',
    name: 'Roles & Permissions Access',
    description: 'Access roles and permission management screens',
    resource: 'page',
    action: 'permissions',
    category: 'page',
    is_sensitive: true,
  },
  {
    id: 'perm-p-testing',
    code: 'page.testing',
    name: 'API & Test Suite Workbench',
    description: 'Access studio testing utilities and system diagnostics (Admin Only)',
    resource: 'page',
    action: 'testing',
    category: 'admin',
    is_sensitive: true,
  },
  {
    id: 'perm-t-view',
    code: 'testing.view',
    name: 'View API & Test Suite',
    description: 'View and inspect diagnostic test suites and test cases',
    resource: 'testing',
    action: 'view',
    category: 'admin',
    is_sensitive: true,
  },
  {
    id: 'perm-t-run',
    code: 'testing.run',
    name: 'Execute Test Suites',
    description: 'Execute automated tests, simulations, and diagnostic runs',
    resource: 'testing',
    action: 'run',
    category: 'admin',
    is_sensitive: true,
  },

  // ==========================================
  // 2. FOUNDATION & TENANCY RESOURCE PERMISSIONS
  // ==========================================
  { id: 'perm-tl-v', code: 'timelog.view', name: 'View Timelogs', description: 'View time logs, labor actuals, and timesheet entries', resource: 'timelog', action: 'view', category: 'resource' },
  { id: 'perm-wf-v', code: 'workflow.view', name: 'View Workflows', description: 'View workflow automation graphs and pipeline rules', resource: 'workflow', action: 'view', category: 'resource' },
  { id: 'perm-rep-v', code: 'reports.view', name: 'View Reports', description: 'View executive analytics, velocity, and burn-down reports', resource: 'reports', action: 'view', category: 'resource' },
  { id: 'perm-role-v', code: 'roles.view', name: 'View Roles', description: 'View role definitions and permission mappings', resource: 'roles', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-role-c', code: 'roles.create', name: 'Create Roles', description: 'Create custom studio roles', resource: 'roles', action: 'create', category: 'admin', is_sensitive: true },
  { id: 'perm-role-u', code: 'roles.update', name: 'Update Roles', description: 'Modify role definitions and permission mappings', resource: 'roles', action: 'update', category: 'admin', is_sensitive: true },
  { id: 'perm-role-d', code: 'roles.delete', name: 'Delete Roles', description: 'Delete custom studio roles', resource: 'roles', action: 'delete', category: 'admin', is_sensitive: true },
  { id: 'perm-grp-v', code: 'group.view', name: 'View Groups', description: 'View user groups and team groupings', resource: 'group', action: 'view', category: 'resource' },
  { id: 'perm-grp-c', code: 'group.create', name: 'Create Groups', description: 'Create user groups and team groupings', resource: 'group', action: 'create', category: 'resource' },
  { id: 'perm-grp-u', code: 'group.update', name: 'Update Groups', description: 'Modify group membership and scoped credentials', resource: 'group', action: 'update', category: 'resource' },
  { id: 'perm-grp-d', code: 'group.delete', name: 'Delete Groups', description: 'Delete user groups', resource: 'group', action: 'delete', category: 'admin' },

  // Positions
  { id: 'perm-pos-v', code: 'position.view', name: 'View Positions', description: 'View studio positions and job titles', resource: 'position', action: 'view', category: 'resource' },
  { id: 'perm-pos-c', code: 'position.create', name: 'Create Positions', description: 'Create studio positions', resource: 'position', action: 'create', category: 'resource' },
  { id: 'perm-pos-u', code: 'position.update', name: 'Update Positions', description: 'Modify studio positions', resource: 'position', action: 'update', category: 'resource' },
  { id: 'perm-pos-d', code: 'position.delete', name: 'Delete Positions', description: 'Delete studio positions', resource: 'position', action: 'delete', category: 'admin' },

  // Calendars & Holidays
  { id: 'perm-cal-v', code: 'calendar.view', name: 'View Calendars', description: 'View studio calendars and scheduled events', resource: 'calendar', action: 'view', category: 'resource' },
  { id: 'perm-cal-c', code: 'calendar.create', name: 'Create Calendar Events', description: 'Create studio calendar events and work calendars', resource: 'calendar', action: 'create', category: 'resource' },
  { id: 'perm-cal-u', code: 'calendar.update', name: 'Update Calendar Events', description: 'Modify calendar events, work calendars, and work hours', resource: 'calendar', action: 'update', category: 'resource' },
  { id: 'perm-cal-d', code: 'calendar.delete', name: 'Delete Calendar Events', description: 'Delete calendar events and work calendars', resource: 'calendar', action: 'delete', category: 'admin' },
  { id: 'perm-hol-v', code: 'holiday.view', name: 'View Holidays', description: 'View studio holidays and blackout dates', resource: 'holiday', action: 'view', category: 'resource' },
  { id: 'perm-hol-c', code: 'holiday.create', name: 'Create Holidays', description: 'Register studio holidays', resource: 'holiday', action: 'create', category: 'resource' },
  { id: 'perm-hol-u', code: 'holiday.update', name: 'Update Holidays', description: 'Modify studio holidays', resource: 'holiday', action: 'update', category: 'resource' },
  { id: 'perm-hol-d', code: 'holiday.delete', name: 'Delete Holidays', description: 'Delete studio holidays', resource: 'holiday', action: 'delete', category: 'admin' },

  // API Keys & Personal Access Tokens
  { id: 'perm-key-v', code: 'api_key.view', name: 'View API Keys', description: 'Inspect platform API keys', resource: 'api_key', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-key-c', code: 'api_key.create', name: 'Create API Keys', description: 'Issue platform API keys', resource: 'api_key', action: 'create', category: 'admin', is_sensitive: true },
  { id: 'perm-key-rv', code: 'api_key.revoke', name: 'Revoke API Keys', description: 'Revoke platform API keys', resource: 'api_key', action: 'revoke', category: 'admin', is_sensitive: true },
  { id: 'perm-key-d', code: 'api_key.delete', name: 'Delete API Keys', description: 'Delete API key records', resource: 'api_key', action: 'delete', category: 'admin', is_sensitive: true },
  { id: 'perm-tok-v', code: 'token.view', name: 'View Personal Access Tokens', description: 'Inspect personal access tokens', resource: 'token', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-tok-c', code: 'token.create', name: 'Create Personal Access Tokens', description: 'Issue personal access tokens', resource: 'token', action: 'create', category: 'admin', is_sensitive: true },
  { id: 'perm-tok-rv', code: 'token.revoke', name: 'Revoke Personal Access Tokens', description: 'Revoke personal access tokens', resource: 'token', action: 'revoke', category: 'admin', is_sensitive: true },
  { id: 'perm-tok-d', code: 'token.delete', name: 'Delete Personal Access Tokens', description: 'Delete token records', resource: 'token', action: 'delete', category: 'admin', is_sensitive: true },

  // People
  { id: 'perm-peo-v', code: 'people.view', name: 'View People', description: 'View crew members and user profiles', resource: 'people', action: 'view', category: 'resource' },
  { id: 'perm-peo-c', code: 'people.create', name: 'Create People', description: 'Create crew members', resource: 'people', action: 'create', category: 'resource' },
  { id: 'perm-peo-u', code: 'people.update', name: 'Update People', description: 'Modify crew member details, rates, and profiles', resource: 'people', action: 'update', category: 'resource' },
  { id: 'perm-peo-a', code: 'people.archive', name: 'Archive People', description: 'Archive crew members from active roster', resource: 'people', action: 'archive', category: 'resource' },
  { id: 'perm-peo-r', code: 'people.restore', name: 'Restore People', description: 'Restore archived crew members', resource: 'people', action: 'restore', category: 'resource' },
  { id: 'perm-peo-d', code: 'people.delete', name: 'Delete People', description: 'Permanently remove crew member accounts', resource: 'people', action: 'delete', category: 'admin', is_sensitive: true },

  // Departments
  { id: 'perm-dep-v', code: 'department.view', name: 'View Departments', description: 'View studio departments and hierarchy', resource: 'department', action: 'view', category: 'resource' },
  { id: 'perm-dep-c', code: 'department.create', name: 'Create Department', description: 'Create new studio department', resource: 'department', action: 'create', category: 'resource' },
  { id: 'perm-dep-u', code: 'department.update', name: 'Update Department', description: 'Update department settings and leads', resource: 'department', action: 'update', category: 'resource' },
  { id: 'perm-dep-a', code: 'department.archive', name: 'Archive Department', description: 'Archive department from active studio list', resource: 'department', action: 'archive', category: 'resource' },
  { id: 'perm-dep-r', code: 'department.restore', name: 'Restore Department', description: 'Restore archived department', resource: 'department', action: 'restore', category: 'resource' },
  { id: 'perm-dep-d', code: 'department.delete', name: 'Delete Department', description: 'Permanently delete department', resource: 'department', action: 'delete', category: 'admin' },

  // Teams
  { id: 'perm-tm-v', code: 'team.view', name: 'View Teams', description: 'View creative units and teams', resource: 'team', action: 'view', category: 'resource' },
  { id: 'perm-tm-c', code: 'team.create', name: 'Create Team', description: 'Create new creative unit or team', resource: 'team', action: 'create', category: 'resource' },
  { id: 'perm-tm-u', code: 'team.update', name: 'Update Team', description: 'Update team assignments and leaders', resource: 'team', action: 'update', category: 'resource' },
  { id: 'perm-tm-a', code: 'team.archive', name: 'Archive Team', description: 'Archive team from active roster', resource: 'team', action: 'archive', category: 'resource' },
  { id: 'perm-tm-r', code: 'team.restore', name: 'Restore Team', description: 'Restore archived team', resource: 'team', action: 'restore', category: 'resource' },
  { id: 'perm-tm-d', code: 'team.delete', name: 'Delete Team', description: 'Permanently delete team', resource: 'team', action: 'delete', category: 'admin' },

  // Offices
  { id: 'perm-off-v', code: 'office.view', name: 'View Offices', description: 'View studio office locations and facilities', resource: 'office', action: 'view', category: 'resource' },
  { id: 'perm-off-c', code: 'office.create', name: 'Create Office', description: 'Add new studio location or facility', resource: 'office', action: 'create', category: 'resource' },
  { id: 'perm-off-u', code: 'office.update', name: 'Update Office', description: 'Modify office details and time zones', resource: 'office', action: 'update', category: 'resource' },
  { id: 'perm-off-a', code: 'office.archive', name: 'Archive Office', description: 'Archive studio office', resource: 'office', action: 'archive', category: 'resource' },
  { id: 'perm-off-r', code: 'office.restore', name: 'Restore Office', description: 'Restore archived studio office', resource: 'office', action: 'restore', category: 'resource' },
  { id: 'perm-off-d', code: 'office.delete', name: 'Delete Office', description: 'Permanently delete studio office', resource: 'office', action: 'delete', category: 'admin' },

  // Clients
  { id: 'perm-cli-v', code: 'client.view', name: 'View Clients', description: 'View client accounts and contacts', resource: 'client', action: 'view', category: 'resource' },
  { id: 'perm-cli-c', code: 'client.create', name: 'Create Client', description: 'Register new studio client', resource: 'client', action: 'create', category: 'resource' },
  { id: 'perm-cli-u', code: 'client.update', name: 'Update Client', description: 'Modify client account details', resource: 'client', action: 'update', category: 'resource' },
  { id: 'perm-cli-a', code: 'client.archive', name: 'Archive Client', description: 'Archive client account', resource: 'client', action: 'archive', category: 'resource' },
  { id: 'perm-cli-r', code: 'client.restore', name: 'Restore Client', description: 'Restore archived client account', resource: 'client', action: 'restore', category: 'resource' },
  { id: 'perm-cli-d', code: 'client.delete', name: 'Delete Client', description: 'Permanently delete client account', resource: 'client', action: 'delete', category: 'admin', is_sensitive: true },

  // Vendors
  { id: 'perm-ven-v', code: 'vendor.view', name: 'View Vendors', description: 'View external vendor studios', resource: 'vendor', action: 'view', category: 'resource' },
  { id: 'perm-ven-c', code: 'vendor.create', name: 'Create Vendor', description: 'Onboard new external vendor studio', resource: 'vendor', action: 'create', category: 'resource' },
  { id: 'perm-ven-u', code: 'vendor.update', name: 'Update Vendor', description: 'Update vendor details and contracts', resource: 'vendor', action: 'update', category: 'resource' },
  { id: 'perm-ven-a', code: 'vendor.archive', name: 'Archive Vendor', description: 'Archive vendor studio', resource: 'vendor', action: 'archive', category: 'resource' },
  { id: 'perm-ven-r', code: 'vendor.restore', name: 'Restore Vendor', description: 'Restore archived vendor studio', resource: 'vendor', action: 'restore', category: 'resource' },
  { id: 'perm-ven-d', code: 'vendor.delete', name: 'Delete Vendor', description: 'Permanently delete vendor studio', resource: 'vendor', action: 'delete', category: 'admin', is_sensitive: true },

  // Projects
  { id: 'perm-prj-v', code: 'project.view', name: 'View Projects', description: 'View project details and milestones', resource: 'project', action: 'view', category: 'resource' },
  { id: 'perm-prj-c', code: 'project.create', name: 'Create Project', description: 'Create and initialize new VFX production', resource: 'project', action: 'create', category: 'resource' },
  { id: 'perm-prj-u', code: 'project.update', name: 'Update Project', description: 'Modify project parameters and deadlines', resource: 'project', action: 'update', category: 'resource' },
  { id: 'perm-prj-a', code: 'project.archive', name: 'Archive Project', description: 'Archive completed production', resource: 'project', action: 'archive', category: 'resource' },
  { id: 'perm-prj-r', code: 'project.restore', name: 'Restore Project', description: 'Restore archived production', resource: 'project', action: 'restore', category: 'resource' },
  { id: 'perm-prj-d', code: 'project.delete', name: 'Delete Project', description: 'Permanently delete project database', resource: 'project', action: 'delete', category: 'admin', is_sensitive: true },
  { id: 'perm-prj-cl', code: 'project.clone', name: 'Clone Project', description: 'Duplicate project schema and hierarchy', resource: 'project', action: 'clone', category: 'workflow' },
  { id: 'perm-prj-cls', code: 'project.close', name: 'Close Project', description: 'Conclude and lock project deliverables', resource: 'project', action: 'close', category: 'workflow' },

  // ==========================================
  // 3. PRODUCTION DOMAIN PERMISSIONS
  // ==========================================
  // Editorial
  { id: 'perm-edt-v', code: 'editorial.view', name: 'View Editorial', description: 'View editorial cuts and timelines', resource: 'editorial', action: 'view', category: 'resource' },
  { id: 'perm-edt-c', code: 'editorial.create', name: 'Create Cut', description: 'Create new editorial cut or conform record', resource: 'editorial', action: 'create', category: 'resource' },
  { id: 'perm-edt-u', code: 'editorial.update', name: 'Update Cut', description: 'Modify editorial cut details', resource: 'editorial', action: 'update', category: 'resource' },
  { id: 'perm-edt-d', code: 'editorial.delete', name: 'Delete Cut', description: 'Delete editorial cut record', resource: 'editorial', action: 'delete', category: 'resource' },
  { id: 'perm-edt-p', code: 'editorial.publish', name: 'Publish Cut', description: 'Publish locked cut to production pipeline', resource: 'editorial', action: 'publish', category: 'workflow' },
  { id: 'perm-edt-i', code: 'editorial.import_edl', name: 'Import EDL/XML', description: 'Ingest EDL, XML, or OTIO conform timelines', resource: 'editorial', action: 'import_edl', category: 'workflow' },

  // Episodes
  { id: 'perm-ep-v', code: 'episode.view', name: 'View Episodes', description: 'View episodes and story breakdowns', resource: 'episode', action: 'view', category: 'resource' },
  { id: 'perm-ep-c', code: 'episode.create', name: 'Create Episode', description: 'Create new episode in episodic project', resource: 'episode', action: 'create', category: 'resource' },
  { id: 'perm-ep-u', code: 'episode.update', name: 'Update Episode', description: 'Update episode details and schedule', resource: 'episode', action: 'update', category: 'resource' },
  { id: 'perm-ep-d', code: 'episode.delete', name: 'Delete Episode', description: 'Delete episode', resource: 'episode', action: 'delete', category: 'resource' },
  { id: 'perm-ep-a', code: 'episode.archive', name: 'Archive Episode', description: 'Archive episode', resource: 'episode', action: 'archive', category: 'resource' },
  { id: 'perm-ep-r', code: 'episode.restore', name: 'Restore Episode', description: 'Restore archived episode', resource: 'episode', action: 'restore', category: 'resource' },

  // Sequences
  { id: 'perm-seq-v', code: 'sequence.view', name: 'View Sequences', description: 'View sequences and shot breakdowns', resource: 'sequence', action: 'view', category: 'resource' },
  { id: 'perm-seq-c', code: 'sequence.create', name: 'Create Sequence', description: 'Create new sequence in project', resource: 'sequence', action: 'create', category: 'resource' },
  { id: 'perm-seq-u', code: 'sequence.update', name: 'Update Sequence', description: 'Update sequence details and leads', resource: 'sequence', action: 'update', category: 'resource' },
  { id: 'perm-seq-d', code: 'sequence.delete', name: 'Delete Sequence', description: 'Delete sequence and associated metadata', resource: 'sequence', action: 'delete', category: 'resource' },
  { id: 'perm-seq-a', code: 'sequence.archive', name: 'Archive Sequence', description: 'Archive sequence', resource: 'sequence', action: 'archive', category: 'resource' },
  { id: 'perm-seq-r', code: 'sequence.restore', name: 'Restore Sequence', description: 'Restore archived sequence', resource: 'sequence', action: 'restore', category: 'resource' },

  // Shots
  { id: 'perm-sht-v', code: 'shot.view', name: 'View Shots', description: 'View shots and frame metadata', resource: 'shot', action: 'view', category: 'resource' },
  { id: 'perm-sht-c', code: 'shot.create', name: 'Create Shot', description: 'Create new shot in sequence', resource: 'shot', action: 'create', category: 'resource' },
  { id: 'perm-sht-u', code: 'shot.update', name: 'Update Shot', description: 'Update shot parameters, frame range, and complexity', resource: 'shot', action: 'update', category: 'resource' },
  { id: 'perm-sht-d', code: 'shot.delete', name: 'Delete Shot', description: 'Delete shot entity', resource: 'shot', action: 'delete', category: 'resource' },
  { id: 'perm-sht-as', code: 'shot.assign', name: 'Assign Shot', description: 'Assign artist or vendor to shot', resource: 'shot', action: 'assign', category: 'workflow' },
  { id: 'perm-sht-ua', code: 'shot.unassign', name: 'Unassign Shot', description: 'Remove artist or vendor assignment from shot', resource: 'shot', action: 'unassign', category: 'workflow' },
  { id: 'perm-sht-sb', code: 'shot.submit', name: 'Submit Shot', description: 'Submit shot for supervisory dailies review', resource: 'shot', action: 'submit', category: 'workflow' },
  { id: 'perm-sht-ap', code: 'shot.approve', name: 'Approve Shot', description: 'Grant final supervisor or client approval on shot', resource: 'shot', action: 'approve', category: 'workflow' },
  { id: 'perm-sht-ar', code: 'shot.archive', name: 'Archive Shot', description: 'Archive omitted or cut shot', resource: 'shot', action: 'archive', category: 'resource' },
  { id: 'perm-sht-rs', code: 'shot.restore', name: 'Restore Shot', description: 'Restore archived shot', resource: 'shot', action: 'restore', category: 'resource' },

  // Assets
  { id: 'perm-ast-v', code: 'asset.view', name: 'View Assets', description: 'View digital assets catalog and USD models', resource: 'asset', action: 'view', category: 'resource' },
  { id: 'perm-ast-c', code: 'asset.create', name: 'Create Asset', description: 'Create new digital asset', resource: 'asset', action: 'create', category: 'resource' },
  { id: 'perm-ast-u', code: 'asset.update', name: 'Update Asset', description: 'Update asset specifications and LOD levels', resource: 'asset', action: 'update', category: 'resource' },
  { id: 'perm-ast-d', code: 'asset.delete', name: 'Delete Asset', description: 'Delete digital asset', resource: 'asset', action: 'delete', category: 'resource' },
  { id: 'perm-ast-as', code: 'asset.assign', name: 'Assign Asset', description: 'Assign asset build to department or artist', resource: 'asset', action: 'assign', category: 'workflow' },
  { id: 'perm-ast-ua', code: 'asset.unassign', name: 'Unassign Asset', description: 'Unassign asset build', resource: 'asset', action: 'unassign', category: 'workflow' },
  { id: 'perm-ast-pb', code: 'asset.publish', name: 'Publish Asset', description: 'Publish master asset USD component to pipeline', resource: 'asset', action: 'publish', category: 'workflow' },
  { id: 'perm-ast-ar', code: 'asset.archive', name: 'Archive Asset', description: 'Archive obsolete asset', resource: 'asset', action: 'archive', category: 'resource' },
  { id: 'perm-ast-rs', code: 'asset.restore', name: 'Restore Asset', description: 'Restore archived asset', resource: 'asset', action: 'restore', category: 'resource' },

  // Tasks
  { id: 'perm-tsk-v', code: 'task.view', name: 'View Tasks', description: 'View production tasks and assignments', resource: 'task', action: 'view', category: 'resource' },
  { id: 'perm-tsk-c', code: 'task.create', name: 'Create Task', description: 'Create task on shot or asset', resource: 'task', action: 'create', category: 'resource' },
  { id: 'perm-tsk-u', code: 'task.update', name: 'Update Task', description: 'Update task details, bid days, and description', resource: 'task', action: 'update', category: 'resource' },
  { id: 'perm-tsk-d', code: 'task.delete', name: 'Delete Task', description: 'Delete production task', resource: 'task', action: 'delete', category: 'resource' },
  { id: 'perm-tsk-as', code: 'task.assign', name: 'Assign Task', description: 'Assign artist or team to task', resource: 'task', action: 'assign', category: 'workflow' },
  { id: 'perm-tsk-ra', code: 'task.reassign', name: 'Reassign Task', description: 'Reassign task to different artist', resource: 'task', action: 'reassign', category: 'workflow' },
  { id: 'perm-tsk-st', code: 'task.start', name: 'Start Task', description: 'Mark task as In Progress', resource: 'task', action: 'start', category: 'workflow' },
  { id: 'perm-tsk-cm', code: 'task.complete', name: 'Complete Task', description: 'Mark task as complete and ready for review', resource: 'task', action: 'complete', category: 'workflow' },
  { id: 'perm-tsk-ap', code: 'task.approve', name: 'Approve Task', description: 'Lead or supervisor approval on completed task', resource: 'task', action: 'approve', category: 'workflow' },
  { id: 'perm-tsk-ps', code: 'task.pause', name: 'Pause Task', description: 'Put task on hold or pause', resource: 'task', action: 'pause', category: 'workflow' },

  // Versions
  { id: 'perm-ver-v', code: 'version.view', name: 'View Versions', description: 'View version renders, clips, and media history', resource: 'version', action: 'view', category: 'resource' },
  { id: 'perm-ver-c', code: 'version.create', name: 'Create Version', description: 'Upload or generate new version record', resource: 'version', action: 'create', category: 'resource' },
  { id: 'perm-ver-u', code: 'version.update', name: 'Update Version', description: 'Update version metadata and description', resource: 'version', action: 'update', category: 'resource' },
  { id: 'perm-ver-d', code: 'version.delete', name: 'Delete Version', description: 'Delete version media entry', resource: 'version', action: 'delete', category: 'resource' },
  { id: 'perm-ver-sb', code: 'version.submit', name: 'Submit Version', description: 'Submit render version into review session', resource: 'version', action: 'submit', category: 'workflow' },
  { id: 'perm-ver-pb', code: 'version.publish', name: 'Publish Version', description: 'Publish approved version to production pipeline', resource: 'version', action: 'publish', category: 'workflow' },
  { id: 'perm-ver-ss', code: 'version.supersede', name: 'Supersede Version', description: 'Mark version as superseded by a higher iteration', resource: 'version', action: 'supersede', category: 'workflow' },
  { id: 'perm-ver-dl', code: 'version.download', name: 'Download Version', description: 'Download master proxy or EXR media bundle', resource: 'version', action: 'download', category: 'workflow' },

  // Reviews
  { id: 'perm-rev-v', code: 'review.view', name: 'View Reviews', description: 'View review sessions, playlists, and notes', resource: 'review', action: 'view', category: 'resource' },
  { id: 'perm-rev-c', code: 'review.create', name: 'Create Review', description: 'Create review session or dailies playlist', resource: 'review', action: 'create', category: 'resource' },
  { id: 'perm-rev-u', code: 'review.update', name: 'Update Review', description: 'Modify review playlist items and sequence', resource: 'review', action: 'update', category: 'resource' },
  { id: 'perm-rev-d', code: 'review.delete', name: 'Delete Review', description: 'Delete review session', resource: 'review', action: 'delete', category: 'resource' },
  { id: 'perm-rev-cm', code: 'review.comment', name: 'Comment in Review', description: 'Post timecoded text feedback in review room', resource: 'review', action: 'comment', category: 'workflow' },
  { id: 'perm-rev-an', code: 'review.annotate', name: 'Annotate in Review', description: 'Draw synchronous pen/laser canvas annotations', resource: 'review', action: 'annotate', category: 'workflow' },
  { id: 'perm-rev-ap', code: 'review.approve', name: 'Approve in Review', description: 'Formally approve media item in review session', resource: 'review', action: 'approve', category: 'workflow' },
  { id: 'perm-rev-rj', code: 'review.reject', name: 'Reject in Review', description: 'Reject media submission in review session', resource: 'review', action: 'reject', category: 'workflow' },
  { id: 'perm-rev-rc', code: 'review.request_changes', name: 'Request Changes in Review', description: 'Request revisions and specify mandatory fixes', resource: 'review', action: 'request_changes', category: 'workflow' },

  // Notes
  { id: 'perm-nte-v', code: 'note.view', name: 'View Notes', description: 'View production notes and director briefs', resource: 'note', action: 'view', category: 'resource' },
  { id: 'perm-nte-c', code: 'note.create', name: 'Create Note', description: 'Post new production note on entity', resource: 'note', action: 'create', category: 'resource' },
  { id: 'perm-nte-u', code: 'note.update', name: 'Update Note', description: 'Edit note contents and attachments', resource: 'note', action: 'update', category: 'resource' },
  { id: 'perm-nte-d', code: 'note.delete', name: 'Delete Note', description: 'Delete note thread', resource: 'note', action: 'delete', category: 'resource' },
  { id: 'perm-nte-rs', code: 'note.resolve', name: 'Resolve Note', description: 'Mark note action item as resolved', resource: 'note', action: 'resolve', category: 'workflow' },

  // Deliveries
  { id: 'perm-del-v', code: 'delivery.view', name: 'View Deliveries', description: 'View delivery packages and manifest specs', resource: 'delivery', action: 'view', category: 'resource' },
  { id: 'perm-del-c', code: 'delivery.create', name: 'Create Delivery', description: 'Assemble new delivery turnover package', resource: 'delivery', action: 'create', category: 'resource' },
  { id: 'perm-del-u', code: 'delivery.update', name: 'Update Delivery', description: 'Modify delivery items and destination specs', resource: 'delivery', action: 'update', category: 'resource' },
  { id: 'perm-del-d', code: 'delivery.delete', name: 'Delete Delivery', description: 'Delete delivery package', resource: 'delivery', action: 'delete', category: 'resource' },
  { id: 'perm-del-sb', code: 'delivery.submit', name: 'Submit Delivery', description: 'Submit delivery package for QC sign-off', resource: 'delivery', action: 'submit', category: 'workflow' },
  { id: 'perm-del-ap', code: 'delivery.approve', name: 'Approve Delivery', description: 'QC sign-off and approval on delivery package', resource: 'delivery', action: 'approve', category: 'workflow' },
  { id: 'perm-del-rj', code: 'delivery.reject', name: 'Reject Delivery', description: 'Reject delivery package during QC', resource: 'delivery', action: 'reject', category: 'workflow' },
  { id: 'perm-del-pb', code: 'delivery.publish', name: 'Publish Delivery', description: 'Transfer delivery package to client endpoint', resource: 'delivery', action: 'publish', category: 'workflow' },

  // Schedule & Calendar
  { id: 'perm-sch-v', code: 'schedule.view', name: 'View Schedule', description: 'View project and studio schedules', resource: 'schedule', action: 'view', category: 'resource' },
  { id: 'perm-sch-c', code: 'schedule.create', name: 'Create Schedule Event', description: 'Schedule milestone or deadline event', resource: 'schedule', action: 'create', category: 'resource' },
  { id: 'perm-sch-u', code: 'schedule.update', name: 'Update Schedule', description: 'Modify Gantt timelines and dates', resource: 'schedule', action: 'update', category: 'resource' },
  { id: 'perm-sch-d', code: 'schedule.delete', name: 'Delete Schedule Event', description: 'Delete calendar or schedule event', resource: 'schedule', action: 'delete', category: 'resource' },
  { id: 'perm-sch-pb', code: 'schedule.publish', name: 'Publish Schedule', description: 'Publish master studio schedule', resource: 'schedule', action: 'publish', category: 'workflow' },
  { id: 'perm-cev-v', code: 'calendar_event.view', name: 'View Calendar Events', description: 'View studio calendar events', resource: 'calendar_event', action: 'view', category: 'resource' },
  { id: 'perm-cev-c', code: 'calendar_event.create', name: 'Create Calendar Event', description: 'Schedule a studio calendar event', resource: 'calendar_event', action: 'create', category: 'resource' },
  { id: 'perm-cev-u', code: 'calendar_event.update', name: 'Update Calendar Event', description: 'Modify studio calendar events', resource: 'calendar_event', action: 'update', category: 'resource' },
  { id: 'perm-cev-d', code: 'calendar_event.delete', name: 'Delete Calendar Event', description: 'Delete studio calendar events', resource: 'calendar_event', action: 'delete', category: 'resource' },

  // Resources & Capacity
  { id: 'perm-res-v', code: 'resource.view', name: 'View Resources', description: 'View artist capacity and allocations', resource: 'resource', action: 'view', category: 'resource' },
  { id: 'perm-res-c', code: 'resource.create', name: 'Create Resource', description: 'Add capacity resource or workstation profile', resource: 'resource', action: 'create', category: 'resource' },
  { id: 'perm-res-u', code: 'resource.update', name: 'Update Resource', description: 'Modify resource weekly hours and skills', resource: 'resource', action: 'update', category: 'resource' },
  { id: 'perm-res-d', code: 'resource.delete', name: 'Delete Resource', description: 'Remove resource profile', resource: 'resource', action: 'delete', category: 'resource' },
  { id: 'perm-res-as', code: 'resource.assign', name: 'Assign Resource', description: 'Book resource allocation on project', resource: 'resource', action: 'assign', category: 'workflow' },

  // Pipeline & Tooling
  { id: 'perm-pip-v', code: 'pipeline.view', name: 'View Pipeline', description: 'View pipeline environment configs and OCIO', resource: 'pipeline', action: 'view', category: 'resource' },
  { id: 'perm-pip-c', code: 'pipeline.create', name: 'Create Pipeline Config', description: 'Add custom DCC pipeline profile', resource: 'pipeline', action: 'create', category: 'resource' },
  { id: 'perm-pip-u', code: 'pipeline.update', name: 'Update Pipeline', description: 'Modify OCIO configs, plugins, and USD schemas', resource: 'pipeline', action: 'update', category: 'resource' },
  { id: 'perm-pip-d', code: 'pipeline.delete', name: 'Delete Pipeline Config', description: 'Remove pipeline configuration', resource: 'pipeline', action: 'delete', category: 'resource' },
  { id: 'perm-pip-ex', code: 'pipeline.execute', name: 'Execute Pipeline Automation', description: 'Trigger farm dispatch or ingest automation', resource: 'pipeline', action: 'execute', category: 'workflow' },

  // Files & Media
  { id: 'perm-fil-v', code: 'file.view', name: 'View Files', description: 'Browse project file attachments', resource: 'file', action: 'view', category: 'resource' },
  { id: 'perm-fil-c', code: 'file.create', name: 'Upload File', description: 'Upload file attachment to entity', resource: 'file', action: 'create', category: 'resource' },
  { id: 'perm-fil-u', code: 'file.update', name: 'Update File', description: 'Rename or edit file metadata', resource: 'file', action: 'update', category: 'resource' },
  { id: 'perm-fil-d', code: 'file.delete', name: 'Delete File', description: 'Delete file attachment', resource: 'file', action: 'delete', category: 'resource' },
  { id: 'perm-fil-dl', code: 'file.download', name: 'Download File', description: 'Download master asset file', resource: 'file', action: 'download', category: 'workflow' },

  // Media
  { id: 'perm-med-v', code: 'media.view', name: 'View Media', description: 'View streaming playback media', resource: 'media', action: 'view', category: 'resource' },
  { id: 'perm-med-c', code: 'media.create', name: 'Upload Media', description: 'Ingest new media asset', resource: 'media', action: 'create', category: 'resource' },
  { id: 'perm-med-u', code: 'media.update', name: 'Update Media', description: 'Update color space and metadata', resource: 'media', action: 'update', category: 'resource' },
  { id: 'perm-med-d', code: 'media.delete', name: 'Delete Media', description: 'Delete media item', resource: 'media', action: 'delete', category: 'resource' },
  { id: 'perm-med-pb', code: 'media.playback', name: 'Stream High-Res Playback', description: 'Full-resolution EXR/ProRes stream playback', resource: 'media', action: 'playback', category: 'workflow' },

  // Activity & Audit
  { id: 'perm-act-v', code: 'activity.view', name: 'View Activity', description: 'View production event activity stream', resource: 'activity', action: 'view', category: 'resource' },
  { id: 'perm-act-ex', code: 'activity.export', name: 'Export Activity', description: 'Export activity event CSV/JSON logs', resource: 'activity', action: 'export', category: 'workflow' },
  { id: 'perm-aud-v', code: 'audit.view', name: 'View Audit Logs', description: 'Inspect security and data mutation logs', resource: 'audit', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-aud-ex', code: 'audit.export', name: 'Export Audit Logs', description: 'Download compliance audit logs', resource: 'audit', action: 'export', category: 'admin', is_sensitive: true },
  { id: 'perm-apireq-v', code: 'api_request.view', name: 'View API Requests', description: 'Inspect incoming HTTP requests and status codes', resource: 'api_request', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-job-v', code: 'job.view', name: 'View Background Jobs', description: 'Inspect async background tasks and processing queues', resource: 'job', action: 'view', category: 'workflow' },
  { id: 'perm-job-m', code: 'job.manage', name: 'Manage Background Jobs', description: 'Retry, cancel, or re-run background queue jobs', resource: 'job', action: 'manage', category: 'workflow' },
  { id: 'perm-chg-v', code: 'change_log.view', name: 'View Change Logs', description: 'View field-level before and after entity change diffs', resource: 'change_log', action: 'view', category: 'resource' },
  { id: 'perm-err-v', code: 'error_log.view', name: 'View Error Logs', description: 'Inspect application and API exception logs', resource: 'error_log', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-err-m', code: 'error_log.manage', name: 'Manage Error Logs', description: 'Resolve, triage, or clear system error logs', resource: 'error_log', action: 'manage', category: 'admin', is_sensitive: true },
  { id: 'perm-login-v', code: 'login_history.view', name: 'View Login History', description: 'Inspect user authentication, MFA events, and sessions', resource: 'login_history', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-trk-v', code: 'track.view', name: 'View Interaction & Telemetry Tracks', description: 'Inspect user action traces and telemetry tracks', resource: 'track', action: 'view', category: 'admin' },
  { id: 'perm-edit-trk-v', code: 'editorial_track.view', name: 'View Editorial Tracks', description: 'View timeline tracks in editorial workspace', resource: 'editorial_track', action: 'view', category: 'resource' },
  { id: 'perm-edit-trk-m', code: 'editorial_track.manage', name: 'Manage Editorial Tracks', description: 'Create, update, mute/solo/lock editorial timeline tracks', resource: 'editorial_track', action: 'manage', category: 'workflow' },
  // Plural runtime aliases — routes, sidebar, and system roles use these codes
  { id: 'perm-acts-v', code: 'activities.view', name: 'View Activities Stream (alias)', description: 'Alias of activity.view used by activity routes and navigation', resource: 'activities', action: 'view', category: 'resource' },
  { id: 'perm-apireqs-v', code: 'api_requests.view', name: 'View API Requests (alias)', description: 'Alias of api_request.view used by routes, sidebar, and roles', resource: 'api_requests', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-jobs-v', code: 'background_jobs.view', name: 'View Background Jobs (alias)', description: 'Alias of job.view used by routes, sidebar, and roles', resource: 'background_jobs', action: 'view', category: 'workflow' },
  { id: 'perm-chgs-v', code: 'change_logs.view', name: 'View Change Logs (alias)', description: 'Alias of change_log.view used by routes, sidebar, and roles', resource: 'change_logs', action: 'view', category: 'resource' },
  { id: 'perm-errs-v', code: 'error_logs.view', name: 'View Error Logs (alias)', description: 'Alias of error_log.view used by routes, sidebar, and roles', resource: 'error_logs', action: 'view', category: 'admin', is_sensitive: true },
  { id: 'perm-trks-v', code: 'tracks.view', name: 'View Tracks (alias)', description: 'Alias of track.view used by tracks route, sidebar, and roles', resource: 'tracks', action: 'view', category: 'admin' },
  // RBAC management codes used by access workspace and settings routes
  { id: 'perm-perm-m', code: 'permissions.manage', name: 'Manage Permissions', description: 'Grant and revoke permissions across roles and groups', resource: 'permissions', action: 'manage', category: 'admin', is_sensitive: true },
  { id: 'perm-sec-v', code: 'security.view', name: 'View Security Workspace', description: 'Access the access-management security workspace', resource: 'security', action: 'view', category: 'admin', is_sensitive: true },

  // Settings
  { id: 'perm-set-v', code: 'settings.view', name: 'View Settings', description: 'View platform configuration', resource: 'settings', action: 'view', category: 'admin' },
  { id: 'perm-set-u', code: 'settings.update', name: 'Update Settings', description: 'Modify global studio preferences and security', resource: 'settings', action: 'update', category: 'admin', is_sensitive: true },

  // Platform Administration & Global Master Data (Central Platform Level)
  { id: 'perm-p-plat-adm', code: 'page.platform_admin', name: 'Platform Admin Access', description: 'Access platform administration workspace', resource: 'page', action: 'platform_admin', category: 'page', is_sensitive: true },
  { id: 'perm-p-plat-md', code: 'page.platform_master_data', name: 'Platform Master Data Page', description: 'Access central global master data catalog', resource: 'page', action: 'platform_master_data', category: 'page', is_sensitive: true },

  // Generic Platform Administration & Master Data
  { id: 'perm-plat-adm-v', code: 'platform.admin.view', name: 'View Platform Admin', description: 'Inspect platform administration console, master data and telemetry', resource: 'platform', action: 'admin_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-v', code: 'platform.master_data.view', name: 'View Global Master Data', description: 'Inspect canonical global software, statuses, types, and formats', resource: 'platform', action: 'master_data_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-c', code: 'platform.master_data.create', name: 'Create Global Master Data', description: 'Publish new canonical platform master definitions', resource: 'platform', action: 'master_data_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-u', code: 'platform.master_data.update', name: 'Update Global Master Data', description: 'Modify canonical platform master definitions and metadata', resource: 'platform', action: 'master_data_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-a', code: 'platform.master_data.archive', name: 'Archive Global Master Data', description: 'Archive canonical platform master definitions', resource: 'platform', action: 'master_data_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-r', code: 'platform.master_data.restore', name: 'Restore Global Master Data', description: 'Restore archived canonical platform master definitions', resource: 'platform', action: 'master_data_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-md-d', code: 'platform.master_data.delete', name: 'Delete Global Master Data', description: 'Permanently remove draft canonical master definitions', resource: 'platform', action: 'master_data_delete', category: 'admin', is_sensitive: true },

  // Software DCC
  { id: 'perm-plat-soft-v', code: 'platform.software.view', name: 'View Platform Software', description: 'View canonical global software and DCC applications', resource: 'platform', action: 'software_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-soft-c', code: 'platform.software.create', name: 'Create Platform Software', description: 'Create new canonical global software definitions', resource: 'platform', action: 'software_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-soft-u', code: 'platform.software.update', name: 'Update Platform Software', description: 'Update canonical global software definitions', resource: 'platform', action: 'software_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-soft-a', code: 'platform.software.archive', name: 'Archive Platform Software', description: 'Archive canonical software definitions', resource: 'platform', action: 'software_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-soft-r', code: 'platform.software.restore', name: 'Restore Platform Software', description: 'Restore archived software definitions', resource: 'platform', action: 'software_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-soft-d', code: 'platform.software.delete', name: 'Delete Platform Software', description: 'Delete draft software definitions', resource: 'platform', action: 'software_delete', category: 'admin', is_sensitive: true },

  // Software Versions
  { id: 'perm-plat-softv-v', code: 'platform.software_version.view', name: 'View Software Versions', description: 'View software build versions', resource: 'platform', action: 'software_version_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-softv-c', code: 'platform.software_version.create', name: 'Create Software Version', description: 'Publish new version release for a DCC software', resource: 'platform', action: 'software_version_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-softv-u', code: 'platform.software_version.update', name: 'Update Software Version', description: 'Update release metadata or version string', resource: 'platform', action: 'software_version_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-softv-a', code: 'platform.software_version.archive', name: 'Archive Software Version', description: 'Archive deprecated software version', resource: 'platform', action: 'software_version_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-softv-r', code: 'platform.software_version.restore', name: 'Restore Software Version', description: 'Restore archived software version', resource: 'platform', action: 'software_version_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-softv-d', code: 'platform.software_version.delete', name: 'Delete Software Version', description: 'Delete draft software version', resource: 'platform', action: 'software_version_delete', category: 'admin', is_sensitive: true },

  // Workflow Statuses
  { id: 'perm-plat-stat-v', code: 'platform.status.view', name: 'View Platform Statuses', description: 'View global workflow pipeline statuses', resource: 'platform', action: 'status_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-stat-c', code: 'platform.status.create', name: 'Create Platform Status', description: 'Add canonical status to production pipelines', resource: 'platform', action: 'status_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-stat-u', code: 'platform.status.update', name: 'Update Platform Status', description: 'Update status color, code, and workflow category', resource: 'platform', action: 'status_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-stat-a', code: 'platform.status.archive', name: 'Archive Platform Status', description: 'Archive workflow status', resource: 'platform', action: 'status_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-stat-r', code: 'platform.status.restore', name: 'Restore Platform Status', description: 'Restore archived workflow status', resource: 'platform', action: 'status_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-stat-d', code: 'platform.status.delete', name: 'Delete Platform Status', description: 'Delete unreferenced status', resource: 'platform', action: 'status_delete', category: 'admin', is_sensitive: true },

  // Task Types
  { id: 'perm-plat-taskt-v', code: 'platform.task_type.view', name: 'View Task Types', description: 'View canonical task types', resource: 'platform', action: 'task_type_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-taskt-c', code: 'platform.task_type.create', name: 'Create Task Type', description: 'Define new task craft type', resource: 'platform', action: 'task_type_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-taskt-u', code: 'platform.task_type.update', name: 'Update Task Type', description: 'Update task type department mapping and color', resource: 'platform', action: 'task_type_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-taskt-a', code: 'platform.task_type.archive', name: 'Archive Task Type', description: 'Archive canonical task type', resource: 'platform', action: 'task_type_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-taskt-r', code: 'platform.task_type.restore', name: 'Restore Task Type', description: 'Restore archived task type', resource: 'platform', action: 'task_type_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-taskt-d', code: 'platform.task_type.delete', name: 'Delete Task Type', description: 'Delete unreferenced task type', resource: 'platform', action: 'task_type_delete', category: 'admin', is_sensitive: true },

  // Asset Types
  { id: 'perm-plat-assett-v', code: 'platform.asset_type.view', name: 'View Asset Types', description: 'View canonical asset types', resource: 'platform', action: 'asset_type_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-assett-c', code: 'platform.asset_type.create', name: 'Create Asset Type', description: 'Add canonical asset classification', resource: 'platform', action: 'asset_type_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-assett-u', code: 'platform.asset_type.update', name: 'Update Asset Type', description: 'Update asset type definition', resource: 'platform', action: 'asset_type_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-assett-a', code: 'platform.asset_type.archive', name: 'Archive Asset Type', description: 'Archive canonical asset type', resource: 'platform', action: 'asset_type_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-assett-r', code: 'platform.asset_type.restore', name: 'Restore Asset Type', description: 'Restore archived asset type', resource: 'platform', action: 'asset_type_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-assett-d', code: 'platform.asset_type.delete', name: 'Delete Asset Type', description: 'Delete unreferenced asset type', resource: 'platform', action: 'asset_type_delete', category: 'admin', is_sensitive: true },

  // Shot Types
  { id: 'perm-plat-shott-v', code: 'platform.shot_type.view', name: 'View Shot Types', description: 'View canonical shot types', resource: 'platform', action: 'shot_type_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-shott-c', code: 'platform.shot_type.create', name: 'Create Shot Type', description: 'Add canonical shot classification', resource: 'platform', action: 'shot_type_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-shott-u', code: 'platform.shot_type.update', name: 'Update Shot Type', description: 'Update shot type definition', resource: 'platform', action: 'shot_type_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-shott-a', code: 'platform.shot_type.archive', name: 'Archive Shot Type', description: 'Archive canonical shot type', resource: 'platform', action: 'shot_type_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-shott-r', code: 'platform.shot_type.restore', name: 'Restore Shot Type', description: 'Restore archived shot type', resource: 'platform', action: 'shot_type_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-shott-d', code: 'platform.shot_type.delete', name: 'Delete Shot Type', description: 'Delete unreferenced shot type', resource: 'platform', action: 'shot_type_delete', category: 'admin', is_sensitive: true },

  // Review Types
  { id: 'perm-plat-revt-v', code: 'platform.review_type.view', name: 'View Review Types', description: 'View canonical review session types', resource: 'platform', action: 'review_type_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-revt-c', code: 'platform.review_type.create', name: 'Create Review Type', description: 'Add canonical review type', resource: 'platform', action: 'review_type_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-revt-u', code: 'platform.review_type.update', name: 'Update Review Type', description: 'Update review type definition', resource: 'platform', action: 'review_type_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-revt-a', code: 'platform.review_type.archive', name: 'Archive Review Type', description: 'Archive canonical review type', resource: 'platform', action: 'review_type_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-revt-r', code: 'platform.review_type.restore', name: 'Restore Review Type', description: 'Restore archived review type', resource: 'platform', action: 'review_type_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-revt-d', code: 'platform.review_type.delete', name: 'Delete Review Type', description: 'Delete unreferenced review type', resource: 'platform', action: 'review_type_delete', category: 'admin', is_sensitive: true },

  // File Types
  { id: 'perm-plat-filet-v', code: 'platform.file_type.view', name: 'View File Types', description: 'View canonical media/file container types', resource: 'platform', action: 'file_type_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-filet-c', code: 'platform.file_type.create', name: 'Create File Type', description: 'Add canonical file/format definition', resource: 'platform', action: 'file_type_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-filet-u', code: 'platform.file_type.update', name: 'Update File Type', description: 'Update file type definition and MIME mapping', resource: 'platform', action: 'file_type_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-filet-a', code: 'platform.file_type.archive', name: 'Archive File Type', description: 'Archive canonical file type', resource: 'platform', action: 'file_type_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-filet-r', code: 'platform.file_type.restore', name: 'Restore File Type', description: 'Restore archived file type', resource: 'platform', action: 'file_type_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-filet-d', code: 'platform.file_type.delete', name: 'Delete File Type', description: 'Delete unreferenced file type', resource: 'platform', action: 'file_type_delete', category: 'admin', is_sensitive: true },

  // Positions / Roles
  { id: 'perm-plat-pos-v', code: 'platform.position.view', name: 'View Platform Positions', description: 'View canonical job positions and craft titles', resource: 'platform', action: 'position_view', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-pos-c', code: 'platform.position.create', name: 'Create Platform Position', description: 'Define canonical studio position title', resource: 'platform', action: 'position_create', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-pos-u', code: 'platform.position.update', name: 'Update Platform Position', description: 'Update canonical position metadata', resource: 'platform', action: 'position_update', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-pos-a', code: 'platform.position.archive', name: 'Archive Platform Position', description: 'Archive canonical position', resource: 'platform', action: 'position_archive', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-pos-r', code: 'platform.position.restore', name: 'Restore Platform Position', description: 'Restore archived position', resource: 'platform', action: 'position_restore', category: 'admin', is_sensitive: true },
  { id: 'perm-plat-pos-d', code: 'platform.position.delete', name: 'Delete Platform Position', description: 'Delete unreferenced position', resource: 'platform', action: 'position_delete', category: 'admin', is_sensitive: true },
];

/**
 * Quick lookup Map for permissions
 */
export const PERMISSION_MAP = new Map<string, Permission>(
  PERMISSION_CATALOG.map((p) => [p.code, p])
);

/**
 * Group permissions by resource
 */
export function getPermissionsByResource(): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};
  PERMISSION_CATALOG.forEach((p) => {
    if (!grouped[p.resource]) {
      grouped[p.resource] = [];
    }
    grouped[p.resource].push(p);
  });
  return grouped;
}

/**
 * Group permissions by category
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {
    page: [],
    resource: [],
    workflow: [],
    admin: [],
  };
  PERMISSION_CATALOG.forEach((p) => {
    grouped[p.category].push(p);
  });
  return grouped;
}
