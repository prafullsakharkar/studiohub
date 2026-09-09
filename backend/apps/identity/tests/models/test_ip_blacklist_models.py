"""
Identity IP blacklist model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.ip_blacklist import IPBlacklist


class TestIPBlacklistModel:
    """Tests for IPBlacklist model."""

    @pytest.mark.django_db
    def test_create_ip_blacklist(self, ip_blacklist):
        """Test creating an IP blacklist entry."""
        assert ip_blacklist is not None
        assert ip_blacklist.ip_address is not None
        assert ip_blacklist.reason is not None

    @pytest.mark.django_db
    def test_ip_blacklist_uuid_generation(self, ip_blacklist):
        """Test UUID is generated on creation."""
        assert ip_blacklist.uuid is not None
        assert len(str(ip_blacklist.uuid)) == 36

    @pytest.mark.django_db
    def test_ip_blacklist_audit_fields(self, ip_blacklist):
        """Test audit fields are present."""
        assert ip_blacklist.created_at is not None
        assert ip_blacklist.updated_at is not None
        assert ip_blacklist.created_by is None
        assert ip_blacklist.updated_by is None

    @pytest.mark.django_db
    def test_ip_blacklist_soft_delete(self, ip_blacklist):
        """Test soft delete functionality."""
        assert ip_blacklist.deleted_at is None
        ip_blacklist.soft_delete()
        ip_blacklist = type(ip_blacklist).all_objects.get(pk=ip_blacklist.pk)
        assert ip_blacklist.deleted_at is not None

    @pytest.mark.django_db
    def test_ip_blacklist_unique_ip(self, ip_blacklist):
        """Test ip_address field is indexed for lookups."""
        indexes = [
            idx.fields for idx in IPBlacklist._meta.indexes
        ]
        assert ["ip_address"] in indexes

    @pytest.mark.django_db
    def test_ip_blacklist_is_active_default(self, ip_blacklist):
        """Test is_active field default value."""
        assert ip_blacklist.is_active is True

    @pytest.mark.django_db
    def test_ip_blacklist_str_representation(self, ip_blacklist):
        """Test string representation."""
        assert str(ip_blacklist) == ip_blacklist.ip_address

    @pytest.mark.django_db
    def test_ip_blacklist_meta_db_table(self, ip_blacklist):
        """Test database table name."""
        assert ip_blacklist._meta.db_table == "identity_ip_blacklist"
