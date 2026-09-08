from __future__ import annotations

from typing import Any

from django.db import models

from apps.organization.querysets.user_preference import UserPreferenceQuerySet


class UserPreferenceManager(models.Manager):
    """Manager for UserPreference model."""

    def get_queryset(self) -> UserPreferenceQuerySet:
        return UserPreferenceQuerySet(self.model, using=self._db)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def for_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_organization(*args, **kwargs)

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_uuid(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_uuid(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
