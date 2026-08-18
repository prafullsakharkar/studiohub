from apps.identity.models import (
    Profile,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class ProfileSelector(
    IdentityBaseSelector,
):
    """
    Read operations for Profile.
    """

    model = Profile

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        return Profile.objects.select_related(
            "user",
        )

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.get_queryset().filter(
            user=user,
        ).first()
