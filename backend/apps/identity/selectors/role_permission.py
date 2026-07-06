from django.db.models import QuerySet

from apps.identity.models import (
    RolePermission,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class RolePermissionSelector(
    IdentityBaseSelector,
):

    model = RolePermission

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return RolePermission.objects.select_related(
            "role",
            "permission",
        )
