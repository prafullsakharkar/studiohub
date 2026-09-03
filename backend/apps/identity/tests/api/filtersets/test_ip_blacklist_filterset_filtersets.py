"""
Identity IP blacklist filterset tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.ip_blacklist import IPBlacklist
from apps.identity.tests.factories import IPBlacklistFactory, UserFactory


class TestIPBlacklistFilterSet:
    """Tests for IPBlacklistFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_ip_address(self):
        """Test filter by ip_address."""
        from apps.identity.api.filtersets.ip_blacklist import IPBlacklistFilterSet

        entry = IPBlacklistFactory.create(ip_address="192.168.1.1")

        filterset = IPBlacklistFilterSet(
            data={"ip_address": "192.168.1.1"},
            queryset=IPBlacklist.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().ip_address == "192.168.1.1"

    @pytest.mark.django_db
    def test_filter_by_is_active(self):
        """Test filter by is_active."""
        from apps.identity.api.filtersets.ip_blacklist import IPBlacklistFilterSet

        active_entry = IPBlacklistFactory.create(is_active=True)
        inactive_entry = IPBlacklistFactory.create(is_active=False)

        filterset = IPBlacklistFilterSet(
            data={"is_active": True},
            queryset=IPBlacklist.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=active_entry.pk).exists()
        assert not filterset.qs.filter(pk=inactive_entry.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_reason(self):
        """Test filter by reason."""
        from apps.identity.api.filtersets.ip_blacklist import IPBlacklistFilterSet

        entry = IPBlacklistFactory.create(reason="Suspicious activity")

        filterset = IPBlacklistFilterSet(
            data={"reason": "Suspicious activity"},
            queryset=IPBlacklist.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().reason == "Suspicious activity"

    @pytest.mark.django_db
    def test_filter_by_created_by(self):
        """Test filter by created_by."""
        from apps.identity.api.filtersets.ip_blacklist import IPBlacklistFilterSet

        user = UserFactory.create()
        entry = IPBlacklistFactory.create(created_by=user)

        filterset = IPBlacklistFilterSet(
            data={"created_by": user.id},
            queryset=IPBlacklist.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().created_by.id == user.id

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.ip_blacklist import IPBlacklistFilterSet

        IPBlacklistFactory.create(created_at=timezone.now() - timedelta(days=1))
        IPBlacklistFactory.create(created_at=timezone.now())

        filterset = IPBlacklistFilterSet(
            data={"ordering": "created_at"},
            queryset=IPBlacklist.objects.all(),
        )

        assert filterset.is_valid()
        entries = filterset.qs
        assert entries.first().created_at <= entries.last().created_at
