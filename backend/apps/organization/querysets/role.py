from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class RoleQuerySet(BaseQuerySet):
    """
    QuerySet for Role model.
    """

    def for_organization(self, organization):
        """
        Filter by organization.
        """
        return self.filter(organization=organization)

    def system(self):
        """
        Return system roles.
        """
        return self.filter(is_system=True)

    def custom(self):
        """
        Return custom roles.
        """
        return self.filter(is_system=False)

    def default(self):
        """
        Return default roles.
        """
        return self.filter(is_default=True)

    def assignable(self):
        """
        Return assignable roles.
        """
        return self.filter(is_system=False, is_active=True)

    def ordered(self):
        """
        Order by priority and sort order.
        """
        return self.order_by("priority", "sort_order", "name")

    def with_permissions(self):
        """
        Prefetch permissions.
        """
        return self.prefetch_related("role_permissions__permission")
