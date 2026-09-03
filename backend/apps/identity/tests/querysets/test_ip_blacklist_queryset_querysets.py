"""
Identity IP blacklist queryset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistQuerySet:
    """Tests for IPBlacklistQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_entry = IPBlacklistFactory.create()
        assert IPBlacklist.objects.active().filter(pk=active_entry.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        inactive_entry = IPBlacklistFactory.create(is_active=False)
        assert IPBlacklist.objects.inactive().filter(pk=inactive_entry.pk).exists()

    @pytest.mark.django_db
    def test_by_ip_queryset(self):
        """Test by_ip queryset."""
        entry = IPBlacklistFactory.create(ip_address="192.168.1.1")

        assert IPBlacklist.objects.by_ip("192.168.1.1").filter(pk=entry.pk).exists()

    @pytest.mark.django_db
    def test_is_blacklisted_queryset(self):
        """Test is_blacklisted queryset."""
        IPBlacklistFactory.create(ip_address="192.168.1.1")

        assert IPBlacklist.objects.is_blacklisted("192.168.1.1")

    @pytest.mark.django_db
    def test_not_blacklisted_queryset(self):
        """Test is_blacklisted queryset for non-blacklisted IP."""
        assert not IPBlacklist.objects.is_blacklisted("10.0.0.1")
