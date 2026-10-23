"""
Identity trusted device serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import TrustedDeviceFactory


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
