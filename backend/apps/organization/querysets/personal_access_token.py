from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class PersonalAccessTokenQuerySet(BaseQuerySet):
    """
    QuerySet for PersonalAccessToken model.
    """

    def active(self):
        """
        Return active personal access tokens.
        """
        return self.filter(is_active=True)

    def inactive(self):
        """
        Return inactive personal access tokens.
        """
        return self.filter(is_active=False)

    def expired(self):
        """
        Return expired personal access tokens.
        """
        return self.filter(
            models.Q(expires_at__isnull=False) & models.Q(expires_at__lt=models.functions.Now())
        )

    def not_expired(self):
        """
        Return not expired personal access tokens.
        """
        return self.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=models.functions.Now())
        )

    def for_user(self, user):
        """
        Filter by user.
        """
        return self.filter(user=user)

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
        Return tokens that have been used.
        """
        return self.exclude(last_used_at__isnull=True)

    def unused(self):
        """
        Return tokens that have not been used.
        """
        return self.filter(last_used_at__isnull=True)
