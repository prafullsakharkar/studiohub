from django.db.models import Q

from apps.core.models.querysets.base import BaseQuerySet


class RoleQuerySet(BaseQuerySet):

    def active(self):
        return self.filter(is_active=True)

    def system(self):
        return self.filter(is_system=True)

    def default(self):
        return self.filter(is_default=True)

    def organization(self, organization):
        return self.filter(organization=organization)

    def by_code(self, code):
        return self.filter(code=code)

    def search(self, value):
        return self.filter(
            Q(name__icontains=value)
            | Q(code__icontains=value)
            | Q(description__icontains=value)
        )
