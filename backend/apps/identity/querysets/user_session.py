from django.utils import timezone

from apps.identity.querysets.base import IdentityQuerySet


class UserSessionQuerySet(IdentityQuerySet):
    """
    QuerySet for UserSession.
    """

    def active(self):
        return self.filter(
            is_revoked=False,
            expires_at__gt=timezone.now(),
        )

    def revoked(self):
        return self.filter(
            is_revoked=True,
        )

    def expired(self):
        return self.filter(
            expires_at__lte=timezone.now(),
        )

    def current(self):
        return self.filter(
            is_current=True,
        )

    def trusted(self):
        return self.filter(
            is_trusted=True,
        )

    def for_user(self, user):
        return self.filter(
            user=user,
        )

    def recent(self):
        return self.order_by(
            "-last_activity_at",
        )

    def with_related(self):
        return self.select_related(
            "user",
            "revoked_by",
        )

    def inactive(self):
        return self.filter(
            is_active=False,
        )

    def by_device(
        self,
        device,
    ):
        return self.filter(
            device=device,
        )

    def by_ip(
        self,
        ip,
    ):
        return self.filter(
            ip_address=ip,
        )

    def online(self):
        return self.active()

    def offline(self):
        return self.inactive()
