// Permission Utilities for Foundation Apps
import { PERMISSIONS, PermissionCode } from '@/modules/core/constants';
import { useAuth } from '@/modules/auth/hooks/useAuth';

/**
 * Permission hook for foundation apps
 */
export const useFoundationPermissions = () => {
    const { can } = useAuth();

    // User permissions
    const canViewUsers = (permission: PermissionCode = PERMISSIONS.users_view) => can(permission);
    const canCreateUsers = (permission: PermissionCode = PERMISSIONS.users_create) => can(permission);
    const canUpdateUsers = (permission: PermissionCode = PERMISSIONS.users_update) => can(permission);
    const canDeleteUsers = (permission: PermissionCode = PERMISSIONS.users_delete) => can(permission);
    const canActivateUsers = (permission: PermissionCode = PERMISSIONS.users_activate) => can(permission);
    const canDeactivateUsers = (permission: PermissionCode = PERMISSIONS.users_deactivate) => can(permission);
    const canSuspendUsers = (permission: PermissionCode = PERMISSIONS.users_suspend) => can(permission);
    const canUnsuspendUsers = (permission: PermissionCode = PERMISSIONS.users_unsuspend) => can(permission);
    const canResetUserPassword = (permission: PermissionCode = PERMISSIONS.users_reset_password) => can(permission);
    const canForcePasswordChange = (permission: PermissionCode = PERMISSIONS.users_force_password_change) => can(permission);
    const canRevokeUserSessions = (permission: PermissionCode = PERMISSIONS.users_revoke_sessions) => can(permission);
    const canManageUserMFA = (permission: PermissionCode = PERMISSIONS.users_manage_mfa) => can(permission);
    const canManageUserRoles = (permission: PermissionCode = PERMISSIONS.users_manage_roles) => can(permission);
    const canViewUserSecurityEvents = (permission: PermissionCode = PERMISSIONS.users_view_security_events) => can(permission);

    // Role permissions
    const canViewRoles = (permission: PermissionCode = PERMISSIONS.roles_view) => can(permission);
    const canCreateRoles = (permission: PermissionCode = PERMISSIONS.roles_create) => can(permission);
    const canUpdateRoles = (permission: PermissionCode = PERMISSIONS.roles_update) => can(permission);
    const canDeleteRoles = (permission: PermissionCode = PERMISSIONS.roles_delete) => can(permission);
    const canCloneRoles = (permission: PermissionCode = PERMISSIONS.roles_clone) => can(permission);

    // Permission permissions
    const canViewPermissions = (permission: PermissionCode = PERMISSIONS.permissions_view) => can(permission);

    // MFA permissions
    const canViewMFA = (permission: PermissionCode = PERMISSIONS.mfa_view) => can(permission);
    const canEnableMFA = (permission: PermissionCode = PERMISSIONS.mfa_enable) => can(permission);
    const canDisableMFA = (permission: PermissionCode = PERMISSIONS.mfa_disable) => can(permission);
    const canAdminResetMFA = (permission: PermissionCode = PERMISSIONS.mfa_admin_reset) => can(permission);

    // Session permissions
    const canViewSessions = (permission: PermissionCode = PERMISSIONS.sessions_view) => can(permission);
    const canRevokeSession = (permission: PermissionCode = PERMISSIONS.sessions_revoke) => can(permission);
    const canRevokeAllSessions = (permission: PermissionCode = PERMISSIONS.sessions_revoke_all) => can(permission);

    // Organization permissions
    const canViewOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_view) => can(permission);
    const canCreateOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_create) => can(permission);
    const canUpdateOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_update) => can(permission);
    const canDeleteOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_delete) => can(permission);
    const canArchiveOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_archive) => can(permission);
    const canRestoreOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_restore) => can(permission);
    const canSwitchOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_switch) => can(permission);
    const canExportOrganizations = (permission: PermissionCode = PERMISSIONS.organizations_export) => can(permission);

    // Department permissions
    const canViewDepartments = (permission: PermissionCode = PERMISSIONS.departments_view) => can(permission);
    const canCreateDepartments = (permission: PermissionCode = PERMISSIONS.departments_create) => can(permission);
    const canUpdateDepartments = (permission: PermissionCode = PERMISSIONS.departments_update) => can(permission);
    const canDeleteDepartments = (permission: PermissionCode = PERMISSIONS.departments_delete) => can(permission);
    const canArchiveDepartments = (permission: PermissionCode = PERMISSIONS.departments_archive) => can(permission);

    // Team permissions
    const canViewTeams = (permission: PermissionCode = PERMISSIONS.teams_view) => can(permission);
    const canCreateTeams = (permission: PermissionCode = PERMISSIONS.teams_create) => can(permission);
    const canUpdateTeams = (permission: PermissionCode = PERMISSIONS.teams_update) => can(permission);
    const canDeleteTeams = (permission: PermissionCode = PERMISSIONS.teams_delete) => can(permission);
    const canArchiveTeams = (permission: PermissionCode = PERMISSIONS.teams_archive) => can(permission);
    const canManageTeamMembers = (permission: PermissionCode = PERMISSIONS.teams_manage_members) => can(permission);
    const canTransferTeamOwnership = (permission: PermissionCode = PERMISSIONS.teams_transfer_ownership) => can(permission);

    // Office permissions
    const canViewOffices = (permission: PermissionCode = PERMISSIONS.offices_view) => can(permission);
    const canCreateOffices = (permission: PermissionCode = PERMISSIONS.offices_create) => can(permission);
    const canUpdateOffices = (permission: PermissionCode = PERMISSIONS.offices_update) => can(permission);
    const canDeleteOffices = (permission: PermissionCode = PERMISSIONS.offices_delete) => can(permission);
    const canArchiveOffices = (permission: PermissionCode = PERMISSIONS.offices_archive) => can(permission);

    // Membership permissions
    const canViewMemberships = (permission: PermissionCode = PERMISSIONS.memberships_view) => can(permission);
    const canCreateMemberships = (permission: PermissionCode = PERMISSIONS.memberships_create) => can(permission);
    const canUpdateMemberships = (permission: PermissionCode = PERMISSIONS.memberships_update) => can(permission);
    const canDeleteMemberships = (permission: PermissionCode = PERMISSIONS.memberships_delete) => can(permission);
    const canInviteMembers = (permission: PermissionCode = PERMISSIONS.memberships_invite) => can(permission);
    const canResendInvitations = (permission: PermissionCode = PERMISSIONS.memberships_resend_invitation) => can(permission);
    const canCancelInvitations = (permission: PermissionCode = PERMISSIONS.memberships_cancel_invitation) => can(permission);
    const canAcceptInvitations = (permission: PermissionCode = PERMISSIONS.memberships_accept_invitation) => can(permission);
    const canDeclineInvitations = (permission: PermissionCode = PERMISSIONS.memberships_decline_invitation) => can(permission);
    const canBulkUpdateMemberships = (permission: PermissionCode = PERMISSIONS.memberships_bulk_update) => can(permission);

    // Invitation permissions
    const canViewInvitations = (permission: PermissionCode = PERMISSIONS.invitations_view) => can(permission);
    const canSendInvitations = (permission: PermissionCode = PERMISSIONS.invitations_send) => can(permission);
    const canResendInvitation = (permission: PermissionCode = PERMISSIONS.invitations_resend) => can(permission);
    const canRevokeInvitation = (permission: PermissionCode = PERMISSIONS.invitations_revoke) => can(permission);
    const canExpireInvitation = (permission: PermissionCode = PERMISSIONS.invitations_expire) => can(permission);

    // Settings permissions
    const canViewSettings = (permission: PermissionCode = PERMISSIONS.settings_view) => can(permission);
    const canUpdateSettings = (permission: PermissionCode = PERMISSIONS.settings_update) => can(permission);

    // Audit permissions
    const canViewAudit = (permission: PermissionCode = PERMISSIONS.audit_view) => can(permission);
    const canExportAudit = (permission: PermissionCode = PERMISSIONS.audit_export) => can(permission);

    return {
        // Users
        canViewUsers,
        canCreateUsers,
        canUpdateUsers,
        canDeleteUsers,
        canActivateUsers,
        canDeactivateUsers,
        canSuspendUsers,
        canUnsuspendUsers,
        canResetUserPassword,
        canForcePasswordChange,
        canRevokeUserSessions,
        canManageUserMFA,
        canManageUserRoles,
        canViewUserSecurityEvents,

        // Roles
        canViewRoles,
        canCreateRoles,
        canUpdateRoles,
        canDeleteRoles,
        canCloneRoles,

        // Permissions
        canViewPermissions,

        // MFA
        canViewMFA,
        canEnableMFA,
        canDisableMFA,
        canAdminResetMFA,

        // Sessions
        canViewSessions,
        canRevokeSession,
        canRevokeAllSessions,

        // Organizations
        canViewOrganizations,
        canCreateOrganizations,
        canUpdateOrganizations,
        canDeleteOrganizations,
        canArchiveOrganizations,
        canRestoreOrganizations,
        canSwitchOrganizations,
        canExportOrganizations,

        // Departments
        canViewDepartments,
        canCreateDepartments,
        canUpdateDepartments,
        canDeleteDepartments,
        canArchiveDepartments,

        // Teams
        canViewTeams,
        canCreateTeams,
        canUpdateTeams,
        canDeleteTeams,
        canArchiveTeams,
        canManageTeamMembers,
        canTransferTeamOwnership,

        // Offices
        canViewOffices,
        canCreateOffices,
        canUpdateOffices,
        canDeleteOffices,
        canArchiveOffices,

        // Memberships
        canViewMemberships,
        canCreateMemberships,
        canUpdateMemberships,
        canDeleteMemberships,
        canInviteMembers,
        canResendInvitations,
        canCancelInvitations,
        canAcceptInvitations,
        canDeclineInvitations,
        canBulkUpdateMemberships,

        // Invitations
        canViewInvitations,
        canSendInvitations,
        canResendInvitation,
        canRevokeInvitation,
        canExpireInvitation,

        // Settings
        canViewSettings,
        canUpdateSettings,

        // Audit
        canViewAudit,
        canExportAudit,
    };
};

/**
 * Check if user has any of the required permissions
 */
