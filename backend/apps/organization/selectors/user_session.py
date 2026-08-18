from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.querysets.user_session import (
    UserSessionQuerySet,
)


class UserSessionSelector:
    """
    Selector for UserSession model.
    """

    @classmethod
    def get_queryset(cls) -> QuerySet:
        return UserSessionQuerySet(model=UserSessionQuerySet.model)

    @classmethod
    def get_by_id(cls, id: str) -> UserSessionQuerySet.model | None:
        return cls.get_queryset().filter(id=id).first()

    @classmethod
    def get_by_user(cls, user) -> QuerySet:
        return cls.get_queryset().by_user(user)

    @classmethod
    def get_by_organization(cls, organization) -> QuerySet:
        return cls.get_queryset().by_organization(organization)

    @classmethod
    def get_active(cls) -> QuerySet:
        return cls.get_queryset().active()

    @classmethod
    def get_expired(cls) -> QuerySet:
        return cls.get_queryset().expired()

    @classmethod
    def get_current(cls) -> QuerySet:
        return cls.get_queryset().current()

    @classmethod
    def get_trusted(cls) -> QuerySet:
        return cls.get_queryset().trusted()

    @classmethod
    def get_untrusted(cls) -> QuerySet:
        return cls.get_queryset().untrusted()
