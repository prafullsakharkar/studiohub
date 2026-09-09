from apps.identity.models import (
    SecurityEvent,
)
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class SecurityEventSelector(
    IdentityBaseSelector,
):
    """
    Read operations for SecurityEvent.
    """

    model = SecurityEvent

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        return SecurityEvent.objects.select_related(
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
