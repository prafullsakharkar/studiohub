// Core Foundation Constants

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGINATION_OPTIONS = [10, 20, 50, 100];

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'ARCHIVE', 'RESTORE', 'ACTIVATE', 'DEACTIVATE', 'SUSPEND', 'UNSUSPEND'] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

export const AUDIT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type AuditSeverity = typeof AUDIT_SEVERITIES[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const ORGANIZATION_STATUSES = ['ACTIVE', 'ARCHIVED', 'DELETED'] as const;
export type OrganizationStatus = typeof ORGANIZATION_STATUSES[number];

export const DEPARTMENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type DepartmentStatus = typeof DEPARTMENT_STATUSES[number];

export const TEAM_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type TeamStatus = typeof TEAM_STATUSES[number];

export const OFFICE_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type OfficeStatus = typeof OFFICE_STATUSES[number];

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const;
export type InvitationStatus = typeof INVITATION_STATUSES[number];

export const TEAM_TYPES = ['PRODUCTION', 'TECHNICAL', 'ADMINISTRATIVE', 'ARTISTIC'] as const;
export type TeamType = typeof TEAM_TYPES[number];

export const SETTING_CATEGORIES = ['GENERAL', 'SYSTEM', 'SECURITY', 'AUTHENTICATION', 'NOTIFICATIONS', 'LOCALIZATION', 'BRANDING', 'INTEGRATIONS', 'FEATURE_FLAGS'] as const;
export type SettingCategory = typeof SETTING_CATEGORIES[number];

export const SETTING_TYPES = ['string', 'number', 'boolean', 'select', 'multiselect', 'json'] as const;
export type SettingType = typeof SETTING_TYPES[number];

export const FEATURE_FLAG_SCOPES = ['GLOBAL', 'ORGANIZATION', 'USER'] as const;
export type FeatureFlagScope = typeof FEATURE_FLAG_SCOPES[number];

// Permission Codes
export const PERMISSIONS = {
    // Users
    users_view: 'users.view',
    users_create: 'users.create',
    users_update: 'users.update',
    users_delete: 'users.delete',
    users_activate: 'users.activate',
    users_deactivate: 'users.deactivate',
    users_suspend: 'users.suspend',
    users_unsuspend: 'users.unsuspend',
    users_reset_password: 'users.reset_password',
    users_force_password_change: 'users.force_password_change',
    users_revoke_sessions: 'users.revoke_sessions',
    users_manage_mfa: 'users.manage_mfa',
    users_manage_roles: 'users.manage_roles',
    users_view_security_events: 'users.view_security_events',

    // Roles
    roles_view: 'roles.view',
    roles_create: 'roles.create',
    roles_update: 'roles.update',
    roles_delete: 'roles.delete',
    roles_clone: 'roles.clone',

    // Permissions
    permissions_view: 'permissions.view',

    // MFA
    mfa_view: 'mfa.view',
    mfa_enable: 'mfa.enable',
    mfa_disable: 'mfa.disable',
    mfa_admin_reset: 'mfa.admin_reset',

    // Sessions
    sessions_view: 'sessions.view',
    sessions_revoke: 'sessions.revoke',
    sessions_revoke_all: 'sessions.revoke_all',

    // Organizations
    organizations_view: 'organizations.view',
    organizations_create: 'organizations.create',
    organizations_update: 'organizations.update',
    organizations_delete: 'organizations.delete',
    organizations_archive: 'organizations.archive',
    organizations_restore: 'organizations.restore',
    organizations_switch: 'organizations.switch',
    organizations_export: 'organizations.export',

    // Departments
    departments_view: 'departments.view',
    departments_create: 'departments.create',
    departments_update: 'departments.update',
    departments_delete: 'departments.delete',
    departments_archive: 'departments.archive',

    // Teams
    teams_view: 'teams.view',
    teams_create: 'teams.create',
    teams_update: 'teams.update',
    teams_delete: 'teams.delete',
    teams_archive: 'teams.archive',
    teams_manage_members: 'teams.manage_members',
    teams_transfer_ownership: 'teams.transfer_ownership',

    // Offices
    offices_view: 'offices.view',
    offices_create: 'offices.create',
    offices_update: 'offices.update',
    offices_delete: 'offices.delete',
    offices_archive: 'offices.archive',

    // Memberships
    memberships_view: 'memberships.view',
    memberships_create: 'memberships.create',
    memberships_update: 'memberships.update',
    memberships_delete: 'memberships.delete',
    memberships_invite: 'memberships.invite',
    memberships_resend_invitation: 'memberships.resend_invitation',
    memberships_cancel_invitation: 'memberships.cancel_invitation',
    memberships_accept_invitation: 'memberships.accept_invitation',
    memberships_decline_invitation: 'memberships.decline_invitation',
    memberships_bulk_update: 'memberships.bulk_update',

    // Invitations
    invitations_view: 'invitations.view',
    invitations_send: 'invitations.send',
    invitations_resend: 'invitations.resend',
    invitations_revoke: 'invitations.revoke',
    invitations_expire: 'invitations.expire',

    // Settings
    settings_view: 'settings.view',
    settings_update: 'settings.update',

    // Audit
    audit_view: 'audit.view',
    audit_export: 'audit.export',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// API Endpoints
export const API_ENDPOINTS = {
    // Auth
    auth_login: '/api/v1/auth/login/',
    auth_logout: '/api/v1/auth/logout/',
    auth_refresh: '/api/v1/auth/refresh/',
    auth_password_reset: '/api/v1/auth/password-reset/',
    auth_password_change: '/api/v1/auth/password-change/',

    // Users
    users_list: '/api/v1/users/',
    users_detail: (id: string) => `/api/v1/users/${id}/`,
    users_activate: (id: string) => `/api/v1/users/${id}/activate/`,
    users_deactivate: (id: string) => `/api/v1/users/${id}/deactivate/`,
    users_suspend: (id: string) => `/api/v1/users/${id}/suspend/`,
    users_unsuspend: (id: string) => `/api/v1/users/${id}/unsuspend/`,
    users_reset_password: (id: string) => `/api/v1/users/${id}/reset-password/`,
    users_force_password_change: (id: string) => `/api/v1/users/${id}/force-password-change/`,
    users_revoke_sessions: (id: string) => `/api/v1/users/${id}/revoke-sessions/`,
    users_manage_mfa: (id: string) => `/api/v1/users/${id}/mfa/`,
    users_manage_roles: (id: string) => `/api/v1/users/${id}/roles/`,
    users_security_events: (id: string) => `/api/v1/users/${id}/security-events/`,

    // Roles
    roles_list: '/api/v1/roles/',
    roles_detail: (id: string) => `/api/v1/roles/${id}/`,
    roles_clone: (id: string) => `/api/v1/roles/${id}/clone/`,

    // Permissions
    permissions_list: '/api/v1/permissions/',

    // MFA
    mfa_config: '/api/v1/mfa/config/',
    mfa_enable: '/api/v1/mfa/enable/',
    mfa_disable: '/api/v1/mfa/disable/',
    mfa_verify: '/api/v1/mfa/verify/',
    mfa_totp_secret: '/api/v1/mfa/totp/secret/',
    mfa_recovery_codes: '/api/v1/mfa/recovery-codes/',

    // Sessions
    sessions_list: '/api/v1/sessions/',
    sessions_detail: (id: string) => `/api/v1/sessions/${id}/`,
    sessions_revoke: (id: string) => `/api/v1/sessions/${id}/revoke/`,
    sessions_revoke_all: '/api/v1/sessions/revoke-all/',

    // Organizations
    organizations_list: '/api/v1/organizations/',
    organizations_detail: (id: string) => `/api/v1/organizations/${id}/`,
    organizations_switch: (id: string) => `/api/v1/organizations/${id}/switch/`,
    organizations_archive: (id: string) => `/api/v1/organizations/${id}/archive/`,
    organizations_restore: (id: string) => `/api/v1/organizations/${id}/restore/`,
    organizations_export: (id: string) => `/api/v1/organizations/${id}/export/`,

    // Departments
    departments_list: '/api/v1/departments/',
    departments_detail: (id: string) => `/api/v1/departments/${id}/`,
    departments_archive: (id: string) => `/api/v1/departments/${id}/archive/`,

    // Teams
    teams_list: '/api/v1/teams/',
    teams_detail: (id: string) => `/api/v1/teams/${id}/`,
    teams_archive: (id: string) => `/api/v1/teams/${id}/archive/`,
    teams_members: (id: string) => `/api/v1/teams/${id}/members/`,
    teams_add_member: (id: string) => `/api/v1/teams/${id}/members/add/`,
    teams_remove_member: (id: string) => `/api/v1/teams/${id}/members/remove/`,

    // Offices
    offices_list: '/api/v1/offices/',
    offices_detail: (id: string) => `/api/v1/offices/${id}/`,
    offices_archive: (id: string) => `/api/v1/offices/${id}/archive/`,

    // Memberships
    memberships_list: '/api/v1/memberships/',
    memberships_detail: (id: string) => `/api/v1/memberships/${id}/`,
    memberships_bulk_update: '/api/v1/memberships/bulk-update/',

    // Invitations
    invitations_list: '/api/v1/invitations/',
    invitations_detail: (id: string) => `/api/v1/invitations/${id}/`,
    invitations_send: '/api/v1/invitations/send/',
    invitations_resend: (id: string) => `/api/v1/invitations/${id}/resend/`,
    invitations_revoke: (id: string) => `/api/v1/invitations/${id}/revoke/`,
    invitations_expire: (id: string) => `/api/v1/invitations/${id}/expire/`,
    invitations_accept: (id: string) => `/api/v1/invitations/${id}/accept/`,
    invitations_decline: (id: string) => `/api/v1/invitations/${id}/decline/`,

    // Settings
    settings_list: '/api/v1/settings/',
    settings_detail: (key: string) => `/api/v1/settings/${key}/`,
    settings_update: (key: string) => `/api/v1/settings/${key}/update/`,

    // Audit
    audit_logs_list: '/api/v1/audit/logs/',
    audit_logs_detail: (id: string) => `/api/v1/audit/logs/${id}/`,
    audit_logs_export: '/api/v1/audit/logs/export/',

    // Activity
    activity_list: '/api/v1/activity/',
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];
