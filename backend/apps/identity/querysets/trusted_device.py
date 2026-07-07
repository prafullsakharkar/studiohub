from django.utils import timezone

from apps.core.models import BaseQuerySet


class TrustedDeviceQuerySet(BaseQuerySet):
    def trusted(self):
        return self.filter(
            trusted=True,
            revoked=False,
        )

    def revoked(self):
        return self.filter(revoked=True)

    def expired(self):
        return self.filter(
            expires_at__lte=timezone.now(),
        )

    def active(self):
        return self.filter(
            trusted=True,
            revoked=False,
        ).exclude(
            expires_at__lte=timezone.now(),
        )

    def by_user(self, user):
        return self.filter(user=user)

    def by_fingerprint(self, fingerprint):
        return self.filter(fingerprint=fingerprint)

    def select_related_all(self):
        return self.select_related("user")
