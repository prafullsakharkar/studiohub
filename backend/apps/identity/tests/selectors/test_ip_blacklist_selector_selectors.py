"""
Identity IP blacklist selector tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistSelector:
    """Tests for IPBlacklistSelector."""

    @pytest.mark.django_db
    def test_get_ip_blacklist_by_id(self):
        """Test get_ip_blacklist_by_id method."""
        entry = IPBlacklistFactory.create()
        retrieved_entry = IPBlacklist.objects.get_by_id(entry.id)
        assert retrieved_entry.id == entry.id

    @pytest.mark.django_db
    def test_list_ip_blacklist(self):
        """Test list_ip_blacklist method."""
        IPBlacklistFactory.create_batch(5)
        entries = IPBlacklist.objects.list_ip_blacklist()
        assert entries.count() == 5

    @pytest.mark.django_db
    def test_list_ip_blacklist_with_pagination(self):
        """Test list_ip_blacklist with pagination."""
        IPBlacklistFactory.create_batch(10)
        entries = IPBlacklist.objects.list_ip_blacklist(limit=5, offset=0)
        assert entries.count() == 5

    @pytest.mark.django_db
    def test_list_ip_blacklist_with_ip(self):
        """Test list_ip_blacklist with ip filter."""
        IPBlacklistFactory.create_batch(3, ip_address="192.168.1.1")
        IPBlacklistFactory.create_batch(2, ip_address="10.0.0.1")
        entries = IPBlacklist.objects.list_ip_blacklist(ip_address="192.168.1.1")
        assert entries.count() == 3

    @pytest.mark.django_db
    def test_is_ip_blacklisted(self):
        """Test is_ip_blacklisted method."""
        IPBlacklistFactory.create(ip_address="192.168.1.1")
        assert IPBlacklist.objects.is_ip_blacklisted("192.168.1.1")
        assert not IPBlacklist.objects.is_ip_blacklisted("10.0.0.1")

    @pytest.mark.django_db
    def test_count_ip_blacklist(self):
        """Test count_ip_blacklist method."""
        IPBlacklistFactory.create_batch(5)
        count = IPBlacklist.objects.count_ip_blacklist()
        assert count == 5
