from django.db.models import QuerySet

from apps.identity.models import (
    GroupRole,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class GroupRoleSelector(
    IdentityBaseSelector,
):

    model = GroupRole

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return GroupRole.objects.select_related(
            "group",
            "role",
        )
