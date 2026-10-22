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


class ProfilePermissions:
    VIEW = "identity.profile.view"
    CREATE = "identity.profile.create"
    UPDATE = "identity.profile.update"
    DELETE = "identity.profile.delete"


class IPBlacklistPermissions:
    VIEW = "identity.ip_blacklist.view"
    CREATE = "identity.ip_blacklist.create"
    UPDATE = "identity.ip_blacklist.update"
    DELETE = "identity.ip_blacklist.delete"


class LoginAttemptPermissions:
    VIEW = "identity.login_attempt.view"
    CREATE = "identity.login_attempt.create"
    UPDATE = "identity.login_attempt.update"
    DELETE = "identity.login_attempt.delete"


class SecurityEventPermissions:
    VIEW = "identity.security_event.view"
    CREATE = "identity.security_event.create"
    UPDATE = "identity.security_event.update"
    DELETE = "identity.security_event.delete"


class TrustedDevicePermissions:
    VIEW = "identity.trusted_device.view"
    CREATE = "identity.trusted_device.create"
    UPDATE = "identity.trusted_device.update"
    DELETE = "identity.trusted_device.delete"


class RolePermissions:
    VIEW = "identity.role.view"
    CREATE = "identity.role.create"
    UPDATE = "identity.role.update"
    DELETE = "identity.role.delete"


class GroupPermissions:
    VIEW = "identity.group.view"
    CREATE = "identity.group.create"
    UPDATE = "identity.group.update"
    DELETE = "identity.group.delete"


class PermissionPermissions:
    VIEW = "identity.permission.view"
    CREATE = "identity.permission.create"
    UPDATE = "identity.permission.update"
    DELETE = "identity.permission.delete"


class LoginHistoryPermissions:
    # Read-only: the history is written by the authentication flows only.
    VIEW = "identity.login_history.view"
