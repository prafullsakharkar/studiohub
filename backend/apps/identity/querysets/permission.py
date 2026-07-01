"""
Permission QuerySet.
"""

from django.db.models import Q

from apps.core.models.querysets.base import BaseQuerySet


class PermissionQuerySet(BaseQuerySet):
    """
    Permission QuerySet.
    """

    def active(self):
        return self.filter(is_active=True)

    def inactive(self):
        return self.filter(is_active=False)

    def system(self):
        return self.filter(is_system=True)

    def custom(self):
        return self.filter(is_system=False)

    def by_module(self, module):
        return self.filter(module=module)

    def by_action(self, action):
        return self.filter(action=action)

    def by_category(self, category):
        return self.filter(category=category)

    def by_code(self, code):
        return self.filter(code=code)

    def search(self, value):
        return self.filter(
            Q(name__icontains=value)
            | Q(code__icontains=value)
            | Q(description__icontains=value)
        )
