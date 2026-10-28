"""
Who may do what beyond the code a route asks for (docs/scheduling/CONTRACTS.md section 5).

``HasPermission`` gates a whole action. These checks decide the part that depends on the request:
whether the caller manages the schedule (acts for others), may decide their own leave, or acts on
their own resource. They use the same rules as ``HasPermission`` (credential scopes, role grants,
superuser break-glass), except the override code, which break-glass does not imply.
"""

from __future__ import annotations

from typing import Any

from apps.production.permissions.checks import has_explicit_permission_code, has_permission_code
from apps.scheduling.constants.permissions import SchedulingPermissions


def can_manage(request: Any) -> bool:
    """Holds ``schedule.manage``: may book any resource and file or edit leave for others."""
    return has_permission_code(request, SchedulingPermissions.MANAGE)


def can_decide_own_leave(request: Any) -> bool:
    """Holds ``schedule.sod.override`` through a role (a superuser does not hold it by being one)."""
    return has_explicit_permission_code(request, SchedulingPermissions.SOD_OVERRIDE)


def owns(user: Any, resource: Any) -> bool:
    """Whether ``resource`` is the one that is ``user`` (a person resource linked to their account)."""
    owner = getattr(resource, "user_id", None)
    return owner is not None and owner == getattr(user, "pk", None)
