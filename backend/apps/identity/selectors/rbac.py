"""
RBAC selectors (org-removal B3).

Org-free read accessors for the platform-global authorization resources.
No tenant partition: ``scope_by_request`` is the inherited platform no-op.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.identity.models import Group, Permission, Role


class RoleSelector(BaseSelector):
    model = Role

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Role]:
        # A deleted role is gone from every route (CR-59): the default manager keeps it.
        return Role.objects.select_related("parent").filter(is_deleted=False)


class GroupSelector(BaseSelector):
    model = Group

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Group]:
        return Group.objects.filter(is_deleted=False)


class PermissionSelector(BaseSelector):
    model = Permission

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Permission]:
        return Permission.objects.all()
