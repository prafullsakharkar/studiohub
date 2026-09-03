"""
Identity trusted device queryset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


class TestTrustedDeviceQuerySet:
    """Tests for TrustedDeviceQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.active().filter(pk=active_device.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        inactive_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.inactive().filter(pk=inactive_device.pk).exists()

    @pytest.mark.django_db
    def test_for_user_queryset(self):
        """Test for_user queryset."""
        user = UserFactory.create()
        device = TrustedDeviceFactory.create(user=user)

        assert TrustedDevice.objects.for_user(user).filter(pk=device.pk).exists()

    @pytest.mark.django_db
    def test_recently_used_queryset(self):
        """Test recently_used queryset."""
        recent_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.recently_used().filter(pk=recent_device.pk).exists()

    @pytest.mark.django_db
    def test_by_ip_queryset(self):
        """Test by_ip queryset."""
        device = TrustedDeviceFactory.create(ip_address="192.168.1.1")

        assert TrustedDevice.objects.by_ip("192.168.1.1").filter(pk=device.pk).exists()

    @pytest.mark.django_db
    def test_by_platform_queryset(self):
        """Test by_platform queryset."""
        device = TrustedDeviceFactory.create(platform="web")

        assert TrustedDevice.objects.by_platform("web").filter(pk=device.pk).exists()
