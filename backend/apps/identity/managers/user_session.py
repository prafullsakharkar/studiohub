from __future__ import annotations

from typing import Any

from django.db import models

from apps.identity.querysets.user_session import UserSessionQuerySet


class UserSessionManager(models.Manager):
    """Manager for the identity-owned UserSession model."""

    def get_queryset(self) -> UserSessionQuerySet:
        return UserSessionQuerySet(self.model, using=self._db)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def logged_out(self, *args: Any, **kwargs: Any):
        return self.get_queryset().logged_out(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def by_status(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_status(*args, **kwargs)

    def current(self, *args: Any, **kwargs: Any):
        return self.get_queryset().current(*args, **kwargs)

    def trusted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().trusted(*args, **kwargs)

    def untrusted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().untrusted(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)
