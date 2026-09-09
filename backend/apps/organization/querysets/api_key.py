from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class APIKeyQuerySet(BaseQuerySet):
    """
    QuerySet for APIKey model.
    """

    def active(self):
        """
        Return active API keys.
        """
        return self.filter(is_active=True)

    def inactive(self):
        """
        Return inactive API keys.
        """
        return self.filter(is_active=False)

    def expired(self):
        """
        Return expired API keys.
        """
        return self.filter(
            models.Q(expires_at__isnull=False) & models.Q(expires_at__lt=models.functions.Now())
        )

    def not_expired(self):
        """
        Return not expired API keys.
        """
        return self.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=models.functions.Now())
        )

    def for_organization(self, organization):
        """
        Filter by organization.
        """
        return self.filter(organization=organization)

    def for_user(self, user):
        """
        Filter by user (owner).
        """
        return self.filter(owner=user)

    def with_prefix(self, prefix):
        """
        Filter by prefix.
        """
        return self.filter(prefix__startswith=prefix)

    def with_scope(self, scope):
        """
        Filter by scope.
        """
        return self.filter(scopes__contains=[scope])

    def used(self):
        """
        Return API keys that have been used.
        """
        return self.exclude(last_used_at__isnull=True)

    def unused(self):
        """
        Return API keys that have not been used.
        """
        return self.filter(last_used_at__isnull=True)
