
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
        ADR-0033 D6: the user directory is organization-scoped, with a
        self-service carve-out: a caller may always retrieve their own user
        record (equivalent to ``me``).

        Superusers see everyone; other callers only see users sharing an
        active membership in the request organization (plus themselves).
        No organization context resolves to self-only (fail closed).
        """
        from django.db.models import Q

        qs = User.objects.get_queryset()
        if request is None:
            return qs
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        organization = getattr(request, "organization", None)
        if organization is None:
            return qs.filter(pk=user.pk)
        return qs.filter(
            Q(
                organization_memberships__organization=organization,
                organization_memberships__is_deleted=False,
            )
            | Q(pk=user.pk)
        ).distinct()

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
