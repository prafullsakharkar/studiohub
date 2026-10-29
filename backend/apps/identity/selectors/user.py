
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
        """
        User directory scoping (org-removal B7): the organization dimension
        is gone, so the directory is platform-global for staff, with the
        self-service carve-out preserved: a caller may always retrieve
        their own user record (equivalent to ``me``).

        Superusers and staff see everyone; other callers see only
        themselves. Permission gates (``identity.user.view`` etc.) run
        before this queryset is consulted.
        """
        qs = User.objects.get_queryset()
        if request is None:
            return qs
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return qs.none()
        if user.is_superuser or user.is_staff:
            return qs
        return qs.filter(pk=user.pk)

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
