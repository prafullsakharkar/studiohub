"""
Identity trusted device serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


class TestTrustedDeviceSerializer:
    """Tests for TrustedDeviceSerializer."""

    @pytest.mark.django_db
    def test_trusted_device_serializer_fields(self):
        """Test trusted device serializer fields."""
        from apps.identity.api.serializers.user_preference.base import (
            TrustedDeviceSerializer,
        )

        device = TrustedDeviceFactory.create()
        serializer = TrustedDeviceSerializer(device)

        assert "id" in serializer.data
        assert "user" in serializer.data
        assert "fingerprint" in serializer.data
        assert "browser" in serializer.data
        assert "platform" in serializer.data
        assert "ip_address" in serializer.data
        assert "user_agent" in serializer.data
        assert "last_login_at" in serializer.data
        assert "is_trusted" in serializer.data

    @pytest.mark.django_db
    def test_trusted_device_serializer_create(self):
        """Test trusted device serializer create."""
        from apps.identity.api.serializers.user_preference.create import (
            TrustedDeviceCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "fingerprint": "test-device-fingerprint",
            "browser": "Chrome",
            "platform": "web",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
        }

        serializer = TrustedDeviceCreateSerializer(data=data)
        assert serializer.is_valid()

        device = serializer.save()
        assert device.fingerprint == "test-device-fingerprint"

    @pytest.mark.django_db
    def test_trusted_device_serializer_update(self):
        """Test trusted device serializer update."""
        from apps.identity.api.serializers.user_preference.update import (
            TrustedDeviceUpdateSerializer,
        )

        device = TrustedDeviceFactory.create()

        data = {
            "browser": "Updated Browser",
        }

        serializer = TrustedDeviceUpdateSerializer(device, data=data, partial=True)
        assert serializer.is_valid()

        device = serializer.save()
        assert device.browser == "Updated Browser"

    @pytest.mark.django_db
    def test_trusted_device_serializer_platform_validation(self):
        """Test trusted device serializer fingerprint validation."""
        from apps.identity.api.serializers.user_preference.create import (
            TrustedDeviceCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "fingerprint": "test-device-fingerprint",
            "browser": "Chrome",
            "platform": "web",
            "ip_address": "invalid-ip",
            "user_agent": "Mozilla/5.0",
        }

        serializer = TrustedDeviceCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "ip_address" in serializer.errors
