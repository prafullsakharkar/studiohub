"""
Identity security event queryset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.security_event import SecurityEvent
from apps.identity.models.user import User
from apps.identity.tests.factories import SecurityEventFactory, UserFactory


class TestSecurityEventQuerySet:
    """Tests for SecurityEventQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.active().filter(pk=active_event.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        inactive_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.inactive().filter(pk=inactive_event.pk).exists()

    @pytest.mark.django_db
    def test_for_user_queryset(self):
        """Test for_user queryset."""
        user = UserFactory.create()
        event = SecurityEventFactory.create(user=user)

        assert SecurityEvent.objects.for_user(user).filter(pk=event.pk).exists()

    @pytest.mark.django_db
    def test_by_type_queryset(self):
        """Test by_type queryset."""
        event = SecurityEventFactory.create(event_type="login")

        assert SecurityEvent.objects.by_type("login").filter(pk=event.pk).exists()

    @pytest.mark.django_db
    def test_recent_queryset(self):
        """Test recent queryset."""
        recent_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.recent().filter(pk=recent_event.pk).exists()

    @pytest.mark.django_db
    def test_ip_address_queryset(self):
        """Test ip_address queryset."""
        event = SecurityEventFactory.create(ip_address="192.168.1.1")

        assert SecurityEvent.objects.ip_address("192.168.1.1").filter(pk=event.pk).exists()

    @pytest.mark.django_db
    def test_by_event_type_queryset(self):
        """Test by_event_type queryset."""
        event = SecurityEventFactory.create(event_type="logout")

        assert SecurityEvent.objects.by_event_type("logout").filter(pk=event.pk).exists()
