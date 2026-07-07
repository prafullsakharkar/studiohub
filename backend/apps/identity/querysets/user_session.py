from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.identity.choices import (
    DeviceType,
    SessionStatus,
)
from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class UserSessionQuerySet(
    IdentityQuerySet,
):
    """
    Enterprise QuerySet for UserSession.
    """

    def active(self):
        return self.filter(
            status=SessionStatus.ACTIVE,
        )

    def expired(self):
        return self.filter(
            status=SessionStatus.EXPIRED,
        )

    def revoked(self):
        return self.filter(
            status=SessionStatus.REVOKED,
        )

    def logged_out(self):
        return self.filter(
            status=SessionStatus.LOGGED_OUT,
        )

    def locked(self):
        return self.filter(
            status=SessionStatus.LOCKED,
        )

    def current(self):
        return self.filter(
            is_current=True,
        )

    def trusted(self):
        return self.filter(
            is_trusted=True,
        )

    def untrusted(self):
        return self.filter(
            is_trusted=False,
        )

    def for_user(
        self,
        user,
    ):
        return self.filter(
            user=user,
        )

    def for_organization(
        self,
        organization,
    ):
        return self.filter(
            organization=organization,
        )

    def for_office(
        self,
        office,
    ):
        return self.filter(
            office=office,
        )

    def for_department(
        self,
        department,
    ):
        return self.filter(
            department=department,
        )

    def for_team(
        self,
        team,
    ):
        return self.filter(
            team=team,
        )

    def for_device(
        self,
        device_type: DeviceType,
    ):
        return self.filter(
            device_type=device_type,
        )

    def by_browser(
        self,
        browser,
    ):
        return self.filter(
            browser=browser,
        )

    def by_ip(
        self,
        ip_address,
    ):
        return self.filter(
            ip_address=ip_address,
        )

    def by_status(
        self,
        status,
    ):
        return self.filter(
            status=status,
        )

    def expiring(
        self,
        minutes: int = 30,
    ):
        now = timezone.now()

        return self.filter(
            expires_at__gte=now,
            expires_at__lte=now + timedelta(minutes=minutes),
        )

    def inactive(
        self,
        minutes: int = 30,
    ):
        return self.filter(
            last_activity_at__lte=timezone.now() - timedelta(minutes=minutes),
        )

    def cleanup(self):
        return self.filter(
            expires_at__lt=timezone.now(),
            status=SessionStatus.ACTIVE,
        )
