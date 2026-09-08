
from apps.identity.models import (
    User,
)
from apps.identity.querysets.user import UserQuerySet
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class UserSelector(
    IdentityBaseSelector,
):
    """
    Read operations for User.
    """

    model = User

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> UserQuerySet:
        return User.objects.get_queryset()

    @classmethod
    def get_by_email(
        cls,
        email,
    ):
        return cls.filter(
            email=email,
        ).first()

    @classmethod
    def active(
        cls,
    ):
        return cls.filter(
            is_active=True,
        )

    @classmethod
    def verified(
        cls,
    ):
        return cls.filter(
            is_email_verified=True,
        )

    @classmethod
    def staff(
        cls,
    ):
        return cls.filter(
            is_staff=True,
        )

    @classmethod
    def for_email_search(
        cls,
        value,
    ):
        return cls.filter(
            email__icontains=value,
        )
