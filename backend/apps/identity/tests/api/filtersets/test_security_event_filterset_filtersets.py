"""
Identity security event filterset tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.security_event import SecurityEvent
from apps.identity.tests.factories import SecurityEventFactory, UserFactory


class TestSecurityEventFilterSet:
    """Tests for SecurityEventFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_user(self):
        """Test filter by user."""
        from apps.identity.api.filtersets.user_preference import SecurityEventFilterSet

        user = UserFactory.create()
        SecurityEventFactory.create(user=user)

        filterset = SecurityEventFilterSet(
            data={"user": user.id},
            queryset=SecurityEvent.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().user.id == user.id

    @pytest.mark.django_db
    def test_filter_by_event_type(self):
        """Test filter by event_type."""
        from apps.identity.api.filtersets.user_preference import SecurityEventFilterSet

        login_event = SecurityEventFactory.create(event_type="login")
        logout_event = SecurityEventFactory.create(event_type="logout")

        filterset = SecurityEventFilterSet(
            data={"event_type": "login"},
            queryset=SecurityEvent.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.filter(pk=login_event.pk).exists()
        assert not filterset.qs.filter(pk=logout_event.pk).exists()

    @pytest.mark.django_db
    def test_filter_by_ip_address(self):
        """Test filter by ip_address."""
        from apps.identity.api.filtersets.user_preference import SecurityEventFilterSet

        SecurityEventFactory.create(ip_address="192.168.1.1")

        filterset = SecurityEventFilterSet(
            data={"ip_address": "192.168.1.1"},
            queryset=SecurityEvent.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().ip_address == "192.168.1.1"

    @pytest.mark.django_db
    def test_filter_by_date_range(self):
        """Test filter by date range."""
        from apps.identity.api.filtersets.user_preference import SecurityEventFilterSet

        SecurityEventFactory.create(occurred_at=timezone.now() - timedelta(days=1))
        SecurityEventFactory.create(occurred_at=timezone.now())

        filterset = SecurityEventFilterSet(
            data={
                "start_date": (timezone.now() - timedelta(days=2)).date(),
                "end_date": timezone.now().date(),
            },
            queryset=SecurityEvent.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 2

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.user_preference import SecurityEventFilterSet

        SecurityEventFactory.create(occurred_at=timezone.now() - timedelta(days=1))
        SecurityEventFactory.create(occurred_at=timezone.now())

        filterset = SecurityEventFilterSet(
            data={"ordering": "occurred_at"},
            queryset=SecurityEvent.objects.all(),
        )

        assert filterset.is_valid()
        events = filterset.qs
        assert events.first().occurred_at <= events.last().occurred_at
