from django.utils import timezone

from apps.identity.models import IPBlacklist
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class IPBlacklistValidator(IdentityBaseValidator):
    model = IPBlacklist

    @classmethod
    def validate_create(cls, ip_address=None, network=None, **kwargs):
        if not ip_address and not network:
            cls.raise_validation_error("Either IP address or network must be provided.")

        if ip_address and network:
            cls.raise_validation_error("Cannot specify both IP address and network.")

    @classmethod
    def validate_update(cls, instance: IPBlacklist, **kwargs):
        cls.check_not_none(instance, "IP blacklist entry not found.")

        ip_address = kwargs.get("ip_address")
        network = kwargs.get("network")

        if ip_address is not None and network is not None:
            cls.raise_validation_error("Cannot specify both IP address and network.")

        if ip_address is not None and instance.network:
            cls.raise_validation_error("Cannot change network to IP address.")

        if network is not None and instance.ip_address:
            cls.raise_validation_error("Cannot change IP address to network.")

    @classmethod
    def validate_expire(cls, instance: IPBlacklist, expires_at=None):
        cls.check_not_none(instance, "IP blacklist entry not found.")

        if expires_at and expires_at <= timezone.now():
            cls.raise_validation_error("Expiration date must be in the future.")
