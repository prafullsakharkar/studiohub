from django.utils import timezone

from apps.identity.querysets.base import IdentityQuerySet


class TrustedDeviceQuerySet(IdentityQuerySet):
    def trusted(self):
        return self.filter(
            is_trusted=True,
        )

    def revoked(self):
        return self.filter(
            revoked_at__isnull=False,
        )

    def expired(self):
        return self.filter(
            expires_at__lte=timezone.now(),
        )

    def active(self):
        return (
            self.filter(
                is_trusted=True,
                revoked_at__isnull=True,
            )
            .exclude(
                expires_at__lte=timezone.now(),
            )
        )

    def by_user(self, user):
        return self.filter(user=user)

    def for_user(self, user):
        return self.filter(user=user)

    def by_fingerprint(self, fingerprint):
        return self.filter(fingerprint=fingerprint)

    def by_ip(self, ip_address):
        return self.filter(ip_address=ip_address)

    def by_platform(self, platform):
        return self.filter(platform=platform)

    def recently_used(self):
        return self.filter(
            last_login_at__isnull=False,
        ).order_by(
            "-last_login_at",
        )

    def select_related_all(self):
        return self.select_related("user")

    # ------------------------------------------------------------------
    # Selector-style helpers
    # ------------------------------------------------------------------

    def list_trusted_devices(
        self,
        limit=None,
        offset=None,
        user_id=None,
        platform=None,
        order_by=None,
    ):
        queryset = self.all()

        if user_id is not None:
            queryset = queryset.filter(user_id=user_id)

        if platform is not None:
            queryset = queryset.filter(platform=platform)

        if order_by:
            queryset = queryset.order_by(order_by)
        else:
            queryset = queryset.order_by("-created_at")

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_trusted_devices(self):
        return self.count()

    def get_trusted_device_with_user(self, id):
        return (
            self.filter(pk=id)
            .select_related("user")
            .first()
        )
