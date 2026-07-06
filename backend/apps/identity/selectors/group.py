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

    model = Group

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return Group.objects.prefetch_related(
            "users",
            "group_roles__role",
        )

    @classmethod
    def system(cls):
        return cls.get_queryset().system()

    @classmethod
    def custom(cls):
        return cls.get_queryset().custom()
