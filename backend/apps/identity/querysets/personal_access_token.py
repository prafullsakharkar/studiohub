from __future__ import annotations

from django.db import models
from django.utils import timezone

from apps.core.models.querysets.base import BaseQuerySet


class PersonalAccessTokenQuerySet(BaseQuerySet):
    """
    QuerySet for Personal Access Tokens.
    """

    def active(self):
        return self.filter(
            is_active=True,
        )

    def inactive(self):
        return self.filter(
            is_active=False,
        )

    def revoked(self):
        return self.inactive()

    def expired(self):
        return self.filter(
            expires_at__isnull=False,
            expires_at__lte=timezone.now(),
        )

    def not_expired(self):
        return self.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
        )

    def valid(self):
        return self.active().not_expired().not_deleted()

    def for_user(
        self,
        user,
    ):
        return self.filter(
            user=user,
        )

    def with_prefix(
        self,
        prefix: str,
    ):
        return self.filter(
            prefix=prefix,
        )

    def with_scope(
        self,
        scope: str,
    ):
        return self.filter(
            scopes__contains=[scope],
        )

    def used(self):
        return self.exclude(
            last_used_at__isnull=True,
        )

    def unused(self):
        return self.filter(
            last_used_at__isnull=True,
        )
