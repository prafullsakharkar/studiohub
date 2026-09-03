"""
Identity trusted device manager tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


class TestTrustedDeviceManager:
    """Tests for TrustedDeviceManager."""

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.active().filter(pk=active_device.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        inactive_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.inactive().filter(pk=inactive_device.pk).exists()

    @pytest.mark.django_db
    def test_for_user_manager(self):
        """Test for_user manager."""
        user = UserFactory.create()
        device = TrustedDeviceFactory.create(user=user)

        assert TrustedDevice.objects.for_user(user).filter(pk=device.pk).exists()

    @pytest.mark.django_db
    def test_recently_used_manager(self):
        """Test recently_used manager."""
        recent_device = TrustedDeviceFactory.create()
        assert TrustedDevice.objects.recently_used().filter(pk=recent_device.pk).exists()

    @pytest.mark.django_db
    def test_by_ip_manager(self):
        """Test by_ip manager."""
        device = TrustedDeviceFactory.create(ip_address="192.168.1.1")

        assert TrustedDevice.objects.by_ip("192.168.1.1").filter(pk=device.pk).exists()
