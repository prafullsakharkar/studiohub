from apps.core.models.managers.base import BaseManager


class RoleManager(BaseManager):
    """Manager for the platform-global Role model."""


class PermissionManager(BaseManager):
    """Manager for the platform-global Permission model."""


class RolePermissionManager(BaseManager):
    """Manager for RolePermission grants."""


class UserRoleManager(BaseManager):
    """Manager for UserRole assignments."""


class GroupManager(BaseManager):
    """Manager for the platform-global Group model."""


class GroupMemberManager(BaseManager):
    """Manager for GroupMember rows."""


class GroupRoleManager(BaseManager):
    """Manager for GroupRole assignments."""


class ApiKeyManager(BaseManager):
    """Manager for platform ApiKey records."""


class PersonalAccessTokenManager(BaseManager):
    """Manager for PersonalAccessToken records."""


class LoginHistoryManager(BaseManager):
    """Manager for identity LoginHistory records."""


class PasswordResetTokenManager(BaseManager):
    """Manager for single-use password reset tokens."""
