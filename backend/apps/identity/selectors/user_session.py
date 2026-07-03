from django.db.models import QuerySet

from apps.identity.models import UserSession
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class UserSessionSelector(
    IdentityBaseSelector,
):
    """
    Read operations for UserSession.
    """

    model = UserSession

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:

        return cls.model.objects.with_related()

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def revoked(cls):
        return cls.get_queryset().revoked()

    @classmethod
    def expired(cls):
        return cls.get_queryset().expired()

    @classmethod
    def current(cls):
        return cls.get_queryset().current()

    @classmethod
    def for_user(
        cls,
        user,
    ):
        return cls.get_queryset().for_user(user)
