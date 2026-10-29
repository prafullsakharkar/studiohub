from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet
from apps.identity.choices import SessionStatus


class UserSessionQuerySet(BaseQuerySet):
    """
    QuerySet for the identity-owned UserSession model.

    Platform-global: no organization/department/team scoping.
    """

    def active(self):
        return self.filter(status=SessionStatus.ACTIVE)

    def expired(self):
        from django.utils import timezone

        return self.filter(expires_at__lt=timezone.now())

    def logged_out(self):
        return self.filter(status=SessionStatus.LOGGED_OUT)

    def by_user(self, user):
        return self.filter(user=user)

    def by_status(self, status):
        return self.filter(status=status)

    def current(self):
        return self.filter(is_current=True)

    def trusted(self):
        return self.filter(is_trusted=True)

    def untrusted(self):
        return self.filter(is_trusted=False)

    def inactive(self):
        return self.exclude(status=SessionStatus.ACTIVE)
