"""
Identity trusted device filterset tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.trusted_device import TrustedDevice
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


class TestTrustedDeviceFilterSet:
    """Tests for TrustedDeviceFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_user(self):
        """Test filter by user."""
        from apps.identity.api.filtersets.user_preference import TrustedDeviceFilterSet

        user = UserFactory.create()
        device = TrustedDeviceFactory.create(user=user)

        filterset = TrustedDeviceFilterSet(
            data={"user": user.id},
            queryset=TrustedDevice.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().user.id == user.id

    @pytest.mark.django_db
    def test_filter_by_platform(self):
        """Test filter by platform."""
        from apps.identity.api.filtersets.user_preference import TrustedDeviceFilterSet

        web_device = TrustedDeviceFactory.create(platform="web")
        mobile_device = TrustedDeviceFactory.create(platform="mobile")

        filterset = TrustedDeviceFilterSet(
            data={"platform": "web"},
            queryset=TrustedDevice.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=web_device.pk).exists()
        assert not filterset.qs.filter(pk=mobile_device.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_ip_address(self):
        """Test filter by ip_address."""
        from apps.identity.api.filtersets.user_preference import TrustedDeviceFilterSet

        device = TrustedDeviceFactory.create(ip_address="192.168.1.1")

        filterset = TrustedDeviceFilterSet(
            data={"ip_address": "192.168.1.1"},
            queryset=TrustedDevice.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().ip_address == "192.168.1.1"

    @pytest.mark.django_db
    def test_filter_by_is_trusted(self):
        """Test filter by is_trusted."""
        from apps.identity.api.filtersets.user_preference import TrustedDeviceFilterSet

        trusted_device = TrustedDeviceFactory.create(is_trusted=True)
        untrusted_device = TrustedDeviceFactory.create(is_trusted=False)

        filterset = TrustedDeviceFilterSet(
            data={"is_trusted": True},
            queryset=TrustedDevice.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=trusted_device.pk).exists()
        assert not filterset.qs.filter(pk=untrusted_device.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.user_preference import TrustedDeviceFilterSet

        TrustedDeviceFactory.create(last_login_at=timezone.now() - timedelta(days=1))
        TrustedDeviceFactory.create(last_login_at=timezone.now())

        filterset = TrustedDeviceFilterSet(
            data={"ordering": "last_login_at"},
            queryset=TrustedDevice.objects.all(),
        )

        assert filterset.is_valid()
        devices = filterset.qs
        assert devices.first().last_login_at <= devices.last().last_login_at
