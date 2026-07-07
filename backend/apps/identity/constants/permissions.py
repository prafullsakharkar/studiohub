"""
Identity permission constants.
"""


class UserPermissions:
    VIEW = "identity.user.view"
    CREATE = "identity.user.create"
    UPDATE = "identity.user.update"
    DELETE = "identity.user.delete"

    ACTIVATE = "identity.user.activate"
    DEACTIVATE = "identity.user.deactivate"
    RESTORE = "identity.user.restore"
    ARCHIVE = "identity.user.archive"

    CHANGE_PASSWORD = "identity.user.change_password"
    RESET_PASSWORD = "identity.user.reset_password"

    EXPORT = "identity.user.export"
    IMPORT = "identity.user.import"


class GroupPermissions:
    VIEW = "identity.group.view"
    CREATE = "identity.group.create"
    UPDATE = "identity.group.update"
    DELETE = "identity.group.delete"

    ACTIVATE = "identity.group.activate"
    DEACTIVATE = "identity.group.deactivate"
    RESTORE = "identity.group.restore"
    ARCHIVE = "identity.group.archive"

    EXPORT = "identity.group.export"


class GroupMemberPermissions:
    VIEW = "identity.group_member.view"
    CREATE = "identity.group_member.create"
    UPDATE = "identity.group_member.update"
    DELETE = "identity.group_member.delete"

    ACTIVATE = "identity.group_member.activate"
    DEACTIVATE = "identity.group_member.deactivate"
    RESTORE = "identity.group_member.restore"
    ARCHIVE = "identity.group_member.archive"

    EXPORT = "identity.group_member.export"


class RolePermissions:
    VIEW = "identity.role.view"
    CREATE = "identity.role.create"
    UPDATE = "identity.role.update"
    DELETE = "identity.role.delete"

    ACTIVATE = "identity.role.activate"
    DEACTIVATE = "identity.role.deactivate"
    RESTORE = "identity.role.restore"
    ARCHIVE = "identity.role.archive"

    ASSIGN = "identity.role.assign"
    UNASSIGN = "identity.role.unassign"

    EXPORT = "identity.role.export"
    IMPORT = "identity.role.import"


class PermissionPermissions:
    VIEW = "identity.permission.view"
    CREATE = "identity.permission.create"
    UPDATE = "identity.permission.update"
    DELETE = "identity.permission.delete"

    ACTIVATE = "identity.permission.activate"
    DEACTIVATE = "identity.permission.deactivate"
    RESTORE = "identity.permission.restore"
    ARCHIVE = "identity.permission.archive"

    EXPORT = "identity.permission.export"
    IMPORT = "identity.permission.import"


class GroupPermissions:
    VIEW = "identity.group.view"
    CREATE = "identity.group.create"
    UPDATE = "identity.group.update"
    DELETE = "identity.group.delete"

    ACTIVATE = "identity.group.activate"
    DEACTIVATE = "identity.group.deactivate"
    RESTORE = "identity.group.restore"
    ARCHIVE = "identity.group.archive"

    ASSIGN = "identity.group.assign"
    UNASSIGN = "identity.group.unassign"

    EXPORT = "identity.group.export"
    IMPORT = "identity.group.import"


class UserPreferencePermissions:
    VIEW = "identity.user_preference.view"
    CREATE = "identity.user_preference.create"
    UPDATE = "identity.user_preference.update"
    DELETE = "identity.user_preference.delete"

    EXPORT = "identity.user_preference.export"


class UserSessionPermissions:
    VIEW = "identity.user_session.view"

    LOGOUT = "identity.user_session.logout"

    LOGOUT_ALL = "identity.user_session.logout_all"

    REVOKE = "identity.user_session.revoke"

    TRUST = "identity.user_session.trust"

    REFRESH = "identity.user_session.refresh"


class LoginHistoryPermissions:
    VIEW = "identity.login_history.view"
    DELETE = "identity.login_history.delete"

    EXPORT = "identity.login_history.export"


class APIKeyPermissions:
    VIEW = "identity.api_key.view"
    CREATE = "identity.api_key.create"
    UPDATE = "identity.api_key.update"
    DELETE = "identity.api_key.delete"

    REGENERATE = "identity.api_key.regenerate"


class PersonalAccessTokenPermissions:
    VIEW = "identity.personal_access_token.view"
    CREATE = "identity.personal_access_token.create"
    DELETE = "identity.personal_access_token.delete"

    REVOKE = "identity.personal_access_token.revoke"
