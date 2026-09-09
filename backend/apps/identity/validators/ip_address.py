"""
IP address validator.
"""

from __future__ import annotations

from django.core.validators import validate_ipv46_address

from apps.identity.validators.base import IdentityBaseValidator


class IPAddressValidator(IdentityBaseValidator):
    """Validator for IP addresses."""

    def validate(self, value: str) -> None:
        """Validate that the value is a valid IP address."""
        validate_ipv46_address(value)


def validate_ip_address(value: str) -> None:
    """Validate that the value is a valid IP address."""
    validator = IPAddressValidator()
    validator.validate(value)
