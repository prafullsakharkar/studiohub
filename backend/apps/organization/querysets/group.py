from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class GroupQuerySet(BaseQuerySet):
    """
    QuerySet for Group model.
    """

    def system(self):
        """
        Return system groups.
        """
        return self.filter(is_system=True)

    def custom(self):
        """
        Return custom groups.
        """
        return self.filter(is_system=False)

    def by_name(self, name):
        """
        Filter by name.
        """
        return self.filter(name__icontains=name)

    def by_code(self, code):
        """
        Filter by code.
        """
        return self.filter(code=code)

    def for_organization(self, organization):
        """
        Filter by organization.
        """
        return self.filter(organization=organization)
