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
        queryset = Profile.objects.select_related(
            "user",
        )

        user = getattr(request, "user", None)

        if user is None or user.is_staff or user.is_superuser:
            return queryset

        if not getattr(user, "is_authenticated", False):
            return queryset.none()

        return queryset.filter(
            user=user,
        )

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.get_queryset().filter(
            user=user,
        ).first()
