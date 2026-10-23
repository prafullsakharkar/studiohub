from apps.identity.models import LoginHistory
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class LoginHistorySelector(
    IdentityBaseSelector,
):
    """
    Read operations for LoginHistory.
    """

    model = LoginHistory

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        return LoginHistory.objects.select_related(
            "user",
        )

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.get_queryset().filter(
            user=user,
        )
