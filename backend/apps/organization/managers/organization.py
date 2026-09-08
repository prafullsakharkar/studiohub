"""
Organization manager.
"""

from __future__ import annotations

from typing import Any

from django.db import models

from apps.organization.querysets import OrganizationQuerySet


# NOTE: models.Manager is not subscriptable at runtime, so the bare base
# below is intentional; queryset precision comes from get_queryset().
class OrganizationManager(models.Manager):  # pyright: ignore[reportMissingTypeArgument]
    """
    Manager for Organization model.
    """

    use_in_migrations = True

    def get_queryset(self) -> OrganizationQuerySet:
        return OrganizationQuerySet(self.model, using=self._db)

    def get_by_natural_key(self, code: str):
        """
        Natural key lookup.
        """
        return self.get(code=code)

    def by_slug(self, *args: Any, **kwargs: Any):
        """
        Lookup by slug.
        """
        return self.get_queryset().by_slug(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        """
        Lookup by code.
        """
        return self.get_queryset().by_code(*args, **kwargs)

    def by_country(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_country(*args, **kwargs)

    def by_timezone(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_timezone(*args, **kwargs)

    def with_member_count(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_member_count(*args, **kwargs)

    def with_statistics(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_statistics(*args, **kwargs)

    def lookup(self, *args: Any, **kwargs: Any):
        """
        Lookup by slug, code or name.
        """
        return self.get_queryset().lookup(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        """
        Return active organizations.
        """
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        """
        Return inactive organizations.
        """
        return self.get_queryset().inactive(*args, **kwargs)

    def archived(self, *args: Any, **kwargs: Any):
        """
        Return archived organizations.
        """
        return self.get_queryset().archived(*args, **kwargs)

    def draft(self, *args: Any, **kwargs: Any):
        return self.get_queryset().draft(*args, **kwargs)

    def alive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().alive(*args, **kwargs)

    def deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().deleted(*args, **kwargs)

    def with_deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_deleted(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def newest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().newest(*args, **kwargs)

    def oldest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
