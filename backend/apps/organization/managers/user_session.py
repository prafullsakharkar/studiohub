from __future__ import annotations

from typing import Any

from django.db import models

from apps.organization.querysets.user_session import UserSessionQuerySet


class UserSessionManager(models.Manager):
    """Manager for UserSession model."""

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

    def by_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_organization(*args, **kwargs)

    def by_department(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_department(*args, **kwargs)

    def by_team(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_team(*args, **kwargs)

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
