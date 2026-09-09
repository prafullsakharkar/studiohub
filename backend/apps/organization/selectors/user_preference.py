from __future__ import annotations

from apps.organization.models.user_preference import UserPreference
from apps.organization.querysets.user_preference import (
    UserPreferenceQuerySet,
)


class UserPreferenceSelector:
    """
    Selector for UserPreference model.
    """

    @classmethod
    def get_queryset(cls) -> UserPreferenceQuerySet:
        return UserPreferenceQuerySet(model=UserPreference)

    @classmethod
    def get_by_user(cls, user):
        return cls.get_queryset().by_user(user).first()

    @classmethod
    def get_or_create(cls, user):
        return cls.get_queryset().get_or_create(user=user)
