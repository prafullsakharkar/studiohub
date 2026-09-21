"""
Write-gate mixin: reads stay open to authenticated users, mutations require staff.
"""

from __future__ import annotations

from apps.core.api.permissions.staff import IsStaff
from apps.core.permissions.base import IsAuthenticatedPermission


class StaffWritesRequiredMixin:
    """
    Require staff privileges for state-changing actions.

    Reads (list/retrieve and viewset-specific safe custom actions) keep the
    viewset's default permission classes; every action named in
    ``staff_write_actions`` additionally requires :class:`IsStaff`. Actions
    with no routed name (``action`` is None, e.g. a wrong HTTP method) fall
    through so DRF's own 405 handling still applies.
    """

    staff_write_actions = frozenset(
        {
            "create",
            "update",
            "partial_update",
            "destroy",
            "archive",
            "restore",
            "activate",
            "deactivate",
            "enable",
            "disable",
            "schedule",
            "lock",
            "unlock",
        }
    )

    def get_permissions(self):
        if getattr(self, "action", None) in self.staff_write_actions:
            return [IsAuthenticatedPermission(), IsStaff()]
        return super().get_permissions()  # pyright: ignore[reportAttributeAccessIssue]
