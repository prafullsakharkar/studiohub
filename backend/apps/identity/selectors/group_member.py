from django.db.models import QuerySet

from apps.identity.models import (
    GroupMember,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class GroupMemberSelector(
    IdentityBaseSelector,
):

    model = GroupMember

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return GroupMember.objects.select_related(
            "group",
            "user",
        )
