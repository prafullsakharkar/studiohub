"""
Organization manager.
"""

from __future__ import annotations

from django.db import models

from apps.organization.querysets import OrganizationQuerySet


class OrganizationManager(models.Manager.from_queryset(OrganizationQuerySet)):
    """
    Manager for Organization model.
    """

    use_in_migrations = True

    def get_by_natural_key(self, code: str):
        """
        Natural key lookup.
        """
        return self.get(code=code)

    def active(self):
        """
        Return active organizations.
        """
        return self.get_queryset().active()

    def inactive(self):
        """
        Return inactive organizations.
        """
        return self.get_queryset().inactive()

    def archived(self):
        """
        Return archived organizations.
        """
        return self.get_queryset().archived()

    def by_slug(self, slug: str):
        """
        Lookup by slug.
        """
        return self.get_queryset().by_slug(slug)

    def by_code(self, code: str):
        """
        Lookup by code.
        """
        return self.get_queryset().by_code(code)

    def lookup(self, value: str):
        """
        Lookup by slug, code or name.
        """
        return self.get_queryset().lookup(value)

    def with_statistics(self):
        """
        Return annotated queryset.
        """
        return self.get_queryset().with_statistics()
