from django.db.models import QuerySet

from apps.identity.models import (
    UserPreference,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class UserPreferenceSelector(
    IdentityBaseSelector,
):
    """
    Read operations for UserPreference.
    """

    model = UserPreference

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return UserPreference.objects.select_related(
            "user",
            "default_organization",
            "default_department",
        )

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.filter(
            user=user,
        )
