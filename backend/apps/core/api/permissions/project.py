"""
Project permissions.
"""

from __future__ import annotations

from .base import BasePermission


class IsProjectMember(BasePermission):
    """
    Project membership permission.
    """

    message = "Project membership required."

    def has_object_permission(self, request, view, obj):
        project = getattr(obj, "project", obj)

        if not hasattr(project, "members"):
            return False

        return project.members.filter(pk=request.user.pk).exists()
