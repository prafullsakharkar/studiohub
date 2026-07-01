from django.db import models

from apps.identity.querysets.role import RoleQuerySet


class RoleManager(models.Manager.from_queryset(RoleQuerySet)):

    def create_role(self, **data):
        role = self.model(**data)
        role.full_clean()
        role.save(using=self._db)
        return role

    def get_by_code(self, code, organization=None):
        return self.get(
            code=code,
            organization=organization,
        )
