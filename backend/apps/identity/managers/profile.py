from typing import Any

from django.db import models

from apps.identity.querysets.profile import ProfileQuerySet


class ProfileManager(models.Manager):  # pyright: ignore[reportMissingTypeArgument]
    """Profile manager."""

    def get_queryset(self) -> ProfileQuerySet:
        return ProfileQuerySet(self.model, using=self._db)

    def complete(self, *args: Any, **kwargs: Any):
        return self.get_queryset().complete(*args, **kwargs)

    def missing_avatar(self, *args: Any, **kwargs: Any):
        return self.get_queryset().missing_avatar(*args, **kwargs)

    def by_language(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_language(*args, **kwargs)

    def by_timezone(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_timezone(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def lookup(self, *args: Any, **kwargs: Any):
        return self.get_queryset().lookup(*args, **kwargs)

    def with_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_user(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def order_by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().order_by_name(*args, **kwargs)

    def get_profile_by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_profile_by_user(*args, **kwargs)

    def list_profiles(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_profiles(*args, **kwargs)

    def count_profiles(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_profiles(*args, **kwargs)

    def get_profile_with_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_profile_with_user(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def get_by_id(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_id(*args, **kwargs)

    def count_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_all(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
