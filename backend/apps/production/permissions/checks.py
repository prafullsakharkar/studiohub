"""
Permission-code checks for use inside an already-routed request.

``HasPermission`` gates a whole action. Some writes carry a privileged part
(setting a shot to ``Approved`` through a plain update): the action's own code
admits the request, and the privileged part needs one more code, checked here
with the same rules as ``HasPermission`` (credential scopes, superuser
break-glass, platform-global role grants).
"""

from __future__ import annotations


def has_permission_code(request, code: str) -> bool:
    from apps.identity.permissions.scopes import credential_scopes

    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    scopes = credential_scopes(request)
    if scopes is not None and code not in scopes:
        return False
    return user_has_permission_code(user, code)


def user_has_permission_code(user, code: str) -> bool:
    """Whether ``user`` holds ``code`` through role grants (superusers hold everything)."""
    from apps.identity.services.permission_cache import PermissionCacheService

    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return PermissionCacheService.has_permission(user=user, permission=code)
