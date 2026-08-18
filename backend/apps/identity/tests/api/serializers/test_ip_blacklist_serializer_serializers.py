"""
Identity IP blacklist serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistSerializer:
    """Tests for IPBlacklistSerializer."""

    @pytest.mark.django_db
    def test_ip_blacklist_serializer_fields(self):
        """Test IP blacklist serializer fields."""
        from apps.identity.api.serializers.ip_blacklist.base import IPBlacklistSerializer

        entry = IPBlacklistFactory.create()
        serializer = IPBlacklistSerializer(entry)

        assert "id" in serializer.data
        assert "ip_address" in serializer.data
        assert "reason" in serializer.data
        assert "is_active" in serializer.data
        assert "blocked_by" in serializer.data
        assert "created_at" in serializer.data
        assert "updated_at" in serializer.data

    @pytest.mark.django_db
    def test_ip_blacklist_serializer_create(self):
        """Test IP blacklist serializer create."""
        from apps.identity.api.serializers.ip_blacklist.create import (
            IPBlacklistCreateSerializer,
        )

        data = {
            "ip_address": "192.168.1.1",
            "reason": "Suspicious activity",
        }

        serializer = IPBlacklistCreateSerializer(data=data)
        assert serializer.is_valid()

        entry = serializer.save()
        assert entry.ip_address == "192.168.1.1"

    @pytest.mark.django_db
    def test_ip_blacklist_serializer_update(self):
        """Test IP blacklist serializer update."""
        from apps.identity.api.serializers.ip_blacklist.update import (
            IPBlacklistUpdateSerializer,
        )

        entry = IPBlacklistFactory.create()

        data = {
            "reason": "Updated reason",
        }

        serializer = IPBlacklistUpdateSerializer(entry, data=data, partial=True)
        assert serializer.is_valid()

        entry = serializer.save()
        assert entry.reason == "Updated reason"

    @pytest.mark.django_db
    def test_ip_blacklist_serializer_ip_address_validation(self):
        """Test IP blacklist serializer ip_address validation."""
        from apps.identity.api.serializers.ip_blacklist.create import (
            IPBlacklistCreateSerializer,
        )

        data = {
            "ip_address": "invalid-ip",
            "reason": "Suspicious activity",
        }

        serializer = IPBlacklistCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "ip_address" in serializer.errors

    @pytest.mark.django_db
    def test_ip_blacklist_serializer_duplicate_ip_allowed(self):
        """Test IP blacklist serializer allows duplicate ip_address entries."""
        from apps.identity.api.serializers.ip_blacklist.create import (
            IPBlacklistCreateSerializer,
        )

        entry = IPBlacklistFactory.create()

        data = {
            "ip_address": entry.ip_address,
            "reason": "Another reason",
        }

        serializer = IPBlacklistCreateSerializer(data=data)
        assert serializer.is_valid()
