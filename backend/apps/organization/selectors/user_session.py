from __future__ import annotations

from apps.organization.models.user_session import UserSession
from apps.organization.querysets.user_session import (
    UserSessionQuerySet,
)


class UserSessionSelector:
    """
    Selector for UserSession model.
    """

    @classmethod
    def get_queryset(cls) -> UserSessionQuerySet:
        return UserSessionQuerySet(model=UserSession)

    @classmethod
    def get_by_id(cls, id: str):
        return cls.get_queryset().filter(id=id).first()

    @classmethod
    def get_by_user(cls, user):
        return cls.get_queryset().by_user(user)

    @classmethod
    def get_by_organization(cls, organization):
        return cls.get_queryset().by_organization(organization)

    @classmethod
    def get_active(cls):
        return cls.get_queryset().active()

    @classmethod
    def get_expired(cls):
        return cls.get_queryset().expired()

    @classmethod
    def get_current(cls):
        return cls.get_queryset().current()

    @classmethod
    def get_trusted(cls):
        return cls.get_queryset().trusted()

    @classmethod
    def get_untrusted(cls):
        return cls.get_queryset().untrusted()
