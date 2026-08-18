from apps.identity.models import IPBlacklist
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class IPBlacklistSelector(IdentityBaseSelector):
    model = IPBlacklist

    @classmethod
    def get_active(cls):
        return IPBlacklist.objects.active()

    @classmethod
    def get_expired(cls):
        return IPBlacklist.objects.expired()

    @classmethod
    def by_ip(cls, ip_address):
        return IPBlacklist.objects.by_ip(ip_address)

    @classmethod
    def by_network(cls, network):
        return IPBlacklist.objects.by_network(network)

    @classmethod
    def get_by_user(cls, user):
        return IPBlacklist.objects.by_user(user)
