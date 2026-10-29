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
        return Role.objects.select_related("parent").all()


class GroupSelector(BaseSelector):
    model = Group

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Group]:
        return Group.objects.all()


class PermissionSelector(BaseSelector):
    model = Permission

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Permission]:
        return Permission.objects.all()
