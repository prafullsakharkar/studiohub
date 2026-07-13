from django.db.models import QuerySet

from apps.identity.models import (
    Group,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class GroupSelector(
    IdentityBaseSelector,
):
    """
    Read operations for Group.
    """

    model = Group

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return Group.objects.select_related(
            "organization",
            "parent",
        ).prefetch_related(
            "roles",
            "members",
        )

    @classmethod
    def active(cls):
        return cls.filter(
            is_active=True,
        )

    @classmethod
    def system_groups(cls):
        return cls.filter(
            is_system=True,
        )

    @classmethod
    def organization_groups(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def root_groups(cls):
        return cls.filter(
            parent__isnull=True,
        )

    @classmethod
    def children(
        cls,
        parent,
    ):
        return cls.filter(
            parent=parent,
        )

    @classmethod
    def by_name(
        cls,
        name,
    ):
        return cls.filter(
            name__icontains=name,
        )
