"""
Identity trusted device selector tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


class TestTrustedDeviceSelector:
    """Tests for TrustedDeviceSelector."""

    @pytest.mark.django_db
    def test_get_trusted_device_by_id(self):
        """Test get_trusted_device_by_id method."""
        device = TrustedDeviceFactory.create()
        retrieved_device = TrustedDevice.objects.get_by_id(device.id)
        assert retrieved_device.id == device.id

    @pytest.mark.django_db
    def test_list_trusted_devices(self):
        """Test list_trusted_devices method."""
        TrustedDeviceFactory.create_batch(5)
        devices = TrustedDevice.objects.list_trusted_devices()
        assert devices.count() == 5

    @pytest.mark.django_db
    def test_list_trusted_devices_with_pagination(self):
        """Test list_trusted_devices with pagination."""
        TrustedDeviceFactory.create_batch(10)
        devices = TrustedDevice.objects.list_trusted_devices(limit=5, offset=0)
        assert devices.count() == 5

    @pytest.mark.django_db
    def test_list_trusted_devices_with_user(self):
        """Test list_trusted_devices with user filter."""
        user = UserFactory.create()
        TrustedDeviceFactory.create_batch(3, user=user)
        devices = TrustedDevice.objects.list_trusted_devices(user_id=user.id)
        assert devices.count() == 3

    @pytest.mark.django_db
    def test_list_trusted_devices_with_platform(self):
        """Test list_trusted_devices with platform filter."""
        TrustedDeviceFactory.create_batch(3, platform="web")
        TrustedDeviceFactory.create_batch(2, platform="mobile")
        web_devices = TrustedDevice.objects.list_trusted_devices(platform="web")
        mobile_devices = TrustedDevice.objects.list_trusted_devices(platform="mobile")
        assert web_devices.count() == 3
        assert mobile_devices.count() == 2

    @pytest.mark.django_db
    def test_count_trusted_devices(self):
        """Test count_trusted_devices method."""
        TrustedDeviceFactory.create_batch(5)
        count = TrustedDevice.objects.count_trusted_devices()
        assert count == 5

    @pytest.mark.django_db
    def test_get_trusted_device_with_user(self):
        """Test get_trusted_device_with_user method."""
        device = TrustedDeviceFactory.create()
        retrieved_device = TrustedDevice.objects.get_trusted_device_with_user(device.id)
        assert retrieved_device.id == device.id
        assert hasattr(retrieved_device, "user")
