"""
Identity IP blacklist manager tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistManager:
    """Tests for IPBlacklistManager."""

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_entry = IPBlacklistFactory.create()
        assert IPBlacklist.objects.active().filter(pk=active_entry.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        inactive_entry = IPBlacklistFactory.create(is_active=False)
        assert IPBlacklist.objects.inactive().filter(pk=inactive_entry.pk).exists()

    @pytest.mark.django_db
    def test_by_ip_manager(self):
        """Test by_ip manager."""
        entry = IPBlacklistFactory.create(ip_address="192.168.1.1")

        assert IPBlacklist.objects.by_ip("192.168.1.1").filter(pk=entry.pk).exists()

    @pytest.mark.django_db
    def test_is_blacklisted_manager(self):
        """Test is_blacklisted manager."""
        entry = IPBlacklistFactory.create(ip_address="192.168.1.1")

        assert IPBlacklist.objects.is_blacklisted("192.168.1.1")

    @pytest.mark.django_db
    def test_not_blacklisted_manager(self):
        """Test is_blacklisted manager for non-blacklisted IP."""
        assert not IPBlacklist.objects.is_blacklisted("10.0.0.1")
