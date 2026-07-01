"""
Permission Manager.
"""

from django.db import models

from apps.identity.querysets import (
    PermissionQuerySet,
)


class PermissionManager(models.Manager.from_queryset(PermissionQuerySet)):
    """
    Permission Manager.
    """

    def create_permission(
        self,
        *,
        name,
        code,
        module,
        action,
        category,
        description="",
        is_system=True,
    ):
        permission = self.model(
            name=name,
            code=code,
            module=module,
            action=action,
            category=category,
            description=description,
            is_system=is_system,
        )

        permission.full_clean()
        permission.save(using=self._db)

        return permission

    def get_by_code(self, code):
        return self.get(code=code)
