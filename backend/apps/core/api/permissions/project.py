"""
Project permissions.

NOTE: This module contains logic tied to a "project" concept (membership checks).
The project concept may be domain-specific. Keep here only if "project" is a
first-class platform concept. Otherwise move to the owning domain app (e.g.
`apps.project` or `apps/production`).
"""

from __future__ import annotations

import warnings

from .base import BasePermission

warnings.warn(
    "Core: api.permissions.project.IsProjectMember lives in apps.core but is domain-specific. Consider moving it to the project/production domain app and adding a compatibility shim in core.",
    FutureWarning,
)


class IsProjectMember(BasePermission):
    """
    Project membership permission.
    """

    message = "Project membership required."

    def has_object_permission(self, request, view, obj):
        from typing import cast

        from apps.core.protocols import HasMembers

        project = getattr(obj, "project", obj)

        # Use the HasMembers protocol as the contract for membership checks.
        if not hasattr(project, "members"):
            return False

        members_holder = cast(HasMembers, project)
        # Runtime behavior unchanged; this only documents the expected shape.
        return members_holder.members.filter(pk=request.user.pk).exists()
