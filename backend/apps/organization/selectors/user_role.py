from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import UserRole


class UserRoleSelector(BaseSelector):
    """
    Selector for UserRole model.
    """

    model = UserRole

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get user role queryset.
        """
        queryset = UserRole.objects.all()

        if request and hasattr(request, "user"):
            # Users can see their own roles
            if not request.user.is_superuser:
                queryset = queryset.filter(user=request.user)

        return queryset

    @classmethod
    def for_user(cls, user):
        """
        Filter by user.
        """
        return cls.get_queryset().filter(user=user)

    @classmethod
    def for_role(cls, role):
        """
        Filter by role.
        """
        return cls.get_queryset().filter(role=role)

    @classmethod
    def with_related(cls):
        """
        Prefetch related objects.
        """
        return cls.get_queryset().with_related()
