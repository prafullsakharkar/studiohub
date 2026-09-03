from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet


class PermissionQuerySet(BaseQuerySet):
    """
    QuerySet for Permission model.
    """

    def by_module(self, module):
        """
        Filter by module.
        """
        return self.filter(module=module)

    def by_action(self, action):
        """
        Filter by action.
        """
        return self.filter(action=action)

    def by_category(self, category):
        """
        Filter by category.
        """
        return self.filter(category=category)

    def system(self):
        """
        Return system permissions.
        """
        return self.filter(is_system=True)

    def custom(self):
        """
        Return custom permissions.
        """
        return self.filter(is_system=False)
