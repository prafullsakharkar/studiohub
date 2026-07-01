from django.db import models

from apps.identity.querysets import (
    RolePermissionQuerySet,
)


class RolePermissionManager(models.Manager.from_queryset(RolePermissionQuerySet)):

    def grant(
        self,
        role,
        permission,
        granted_by=None,
    ):

        return self.create(
            role=role,
            permission=permission,
            granted_by=granted_by,
        )
