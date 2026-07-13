from django.db.models import QuerySet

from apps.identity.models import (
    Role,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class RoleSelector(
    IdentityBaseSelector,
):
    """
    Read operations for Role.
    """

    model = Role

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return Role.objects.select_related(
            "organization",
            "parent",
        )

    @classmethod
    def active(cls):
        return cls.filter(
            is_active=True,
        )

    @classmethod
    def system_roles(cls):
        return cls.filter(
            is_system=True,
        )

    @classmethod
    def organization_roles(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def default_roles(cls):
        return cls.filter(
            is_default=True,
        )

    @classmethod
    def by_scope(
        cls,
        scope,
    ):
        return cls.filter(
            scope=scope,
        )

    @classmethod
    def by_priority(
        cls,
        priority,
    ):
        return cls.filter(
            priority=priority,
        )

    @classmethod
    def children(
        cls,
        parent,
    ):
        return cls.filter(
            parent=parent,
        )
