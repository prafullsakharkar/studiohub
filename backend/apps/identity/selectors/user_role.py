from django.db.models import QuerySet

from apps.identity.models import (
    UserRole,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class UserRoleSelector(
    IdentityBaseSelector,
):

    model = UserRole

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return UserRole.objects.select_related(
            "user",
            "role",
        )
