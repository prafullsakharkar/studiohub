"""
Identity IP address validator tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.identity.validators.ip_address import validate_ip_address


class TestIPAddressValidator:
    """Tests for IP address validator."""

    @pytest.mark.django_db
    def test_valid_ipv4(self):
        """Test valid IPv4 addresses."""
        valid_ips = [
            "192.168.1.1",
            "10.0.0.1",
            "172.16.0.1",
            "127.0.0.1",
            "255.255.255.255",
        ]

        for ip in valid_ips:
            try:
                validate_ip_address(ip)
            except ValidationError:
                pytest.fail(f"Valid IP {ip} raised ValidationError")

    @pytest.mark.django_db
    def test_valid_ipv6(self):
        """Test valid IPv6 addresses."""
        valid_ips = [
            "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
            "2001:db8:85a3::8a2e:370:7334",
            "::1",
            "fe80::1",
        ]

        for ip in valid_ips:
            try:
                validate_ip_address(ip)
            except ValidationError:
                pytest.fail(f"Valid IP {ip} raised ValidationError")

    @pytest.mark.django_db
    def test_invalid_ip(self):
        """Test invalid IP addresses."""
        invalid_ips = [
            "256.256.256.256",
            "192.168.1",
            "192.168.1.1.1",
            "not-an-ip",
            "192.168.1.1/24",
        ]

        for ip in invalid_ips:
            with pytest.raises(ValidationError):
                validate_ip_address(ip)

    @pytest.mark.django_db
    def test_ip_with_spaces(self):
        """Test IP with spaces."""
        with pytest.raises(ValidationError):
            validate_ip_address(" 192.168.1.1")
