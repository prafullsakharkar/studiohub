from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import RolePermission


class RolePermissionSelector(BaseSelector):
    """
    Selector for RolePermission model.
    """

    model = RolePermission

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get role permission queryset.
        """
        queryset = RolePermission.objects.all()

        # Users can see role permissions in their organizations
        if request and hasattr(request, "user") and not request.user.is_superuser:
            queryset = queryset.filter(
                role__organization__in=request.user.organizations.all()
            )

        return queryset

    @classmethod
    def for_role(cls, role):
        """
        Filter by role.
        """
        return cls.get_queryset().filter(role=role)

    @classmethod
    def for_permission(cls, permission):
        """
        Filter by permission.
        """
        return cls.get_queryset().filter(permission=permission)

    @classmethod
    def granted(cls):
        """
        Return granted permissions.
        """
        return cls.get_queryset().granted()

    @classmethod
    def revoked(cls):
        """
        Return revoked permissions.
        """
        return cls.get_queryset().revoked()

    @classmethod
    def with_related(cls):
        """
        Prefetch related objects.
        """
        return cls.get_queryset().with_related()
