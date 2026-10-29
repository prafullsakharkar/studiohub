import ipaddress

from django.db import models
from django.utils import timezone

from apps.identity.querysets.base import IdentityQuerySet


class IPBlacklistQuerySet(IdentityQuerySet):
    def active(self):
        return self.filter(
            is_active=True,
        ).filter(
            models.Q(expires_at__isnull=True) |
            models.Q(expires_at__gt=timezone.now()),
        )

    def inactive(self):
        return self.filter(
            is_active=False,
        )

    def expired(self):
        return self.filter(
            expires_at__isnull=False,
        ).filter(
            expires_at__lte=timezone.now(),
        )

    def by_ip(self, ip_address):
        return self.filter(ip_address=ip_address)

    def by_network(self, network):
        return self.filter(network=network)

    def by_user(self, user):
        return self.filter(blocked_by=user)

    def matching(self, ip_address):
        """
        Active entries that cover ``ip_address``: an exact address or a CIDR
        range that contains it. CIDR containment is evaluated in Python so it
        stays database-portable; the active network set is small and only the
        login path asks.
        """
        try:
            address = ipaddress.ip_address(str(ip_address).strip())
        except ValueError:
            return self.none()

        mapped = getattr(address, "ipv4_mapped", None)
        address = mapped or address

        active = self.active()
        ids = set(
            active.filter(ip_address=str(address)).values_list("pk", flat=True)
        )

        for pk, network in active.exclude(network="").values_list("pk", "network"):
            try:
                if address in ipaddress.ip_network(network, strict=False):
                    ids.add(pk)
            except ValueError:
                # A malformed stored range must never match (or crash login).
                continue

        return self.filter(pk__in=ids)

    def is_blacklisted(self, ip_address):
        return self.matching(ip_address).exists()

    def select_related_all(self):
        return self.select_related("blocked_by")

    # ------------------------------------------------------------------
    # Selector-style helpers
    # ------------------------------------------------------------------

    def list_ip_blacklist(
        self,
        limit=None,
        offset=None,
        ip_address=None,
        order_by=None,
    ):
        queryset = self.all()

        if ip_address is not None:
            queryset = queryset.filter(ip_address=ip_address)

        if order_by:
            queryset = queryset.order_by(order_by)

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_ip_blacklist(self):
        return self.count()

    def is_ip_blacklisted(self, ip_address):
        return self.is_blacklisted(ip_address)
