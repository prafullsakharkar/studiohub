from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.querysets.user_preference import (
    UserPreferenceQuerySet,
)


class UserPreferenceSelector:
    """
    Selector for UserPreference model.
    """

    @classmethod
    def get_queryset(cls) -> QuerySet:
        return UserPreferenceQuerySet(model=UserPreferenceQuerySet.model)

    @classmethod
    def get_by_user(cls, user) -> UserPreferenceQuerySet.model | None:
        return cls.get_queryset().by_user(user).first()

    @classmethod
    def get_or_create(cls, user) -> UserPreferenceQuerySet.model:
        return cls.get_queryset().get_or_create(user=user)
