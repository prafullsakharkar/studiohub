"""
Identity security event manager tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.security_event import SecurityEvent
from apps.identity.models.user import User
from apps.identity.tests.factories import SecurityEventFactory, UserFactory


class TestSecurityEventManager:
    """Tests for SecurityEventManager."""

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.active().filter(pk=active_event.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        inactive_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.inactive().filter(pk=inactive_event.pk).exists()

    @pytest.mark.django_db
    def test_for_user_manager(self):
        """Test for_user manager."""
        user = UserFactory.create()
        event = SecurityEventFactory.create(user=user)

        assert SecurityEvent.objects.for_user(user).filter(pk=event.pk).exists()

    @pytest.mark.django_db
    def test_by_type_manager(self):
        """Test by_type manager."""
        event = SecurityEventFactory.create(event_type="login")

        assert SecurityEvent.objects.by_type("login").filter(pk=event.pk).exists()

    @pytest.mark.django_db
    def test_recent_manager(self):
        """Test recent manager."""
        recent_event = SecurityEventFactory.create()
        assert SecurityEvent.objects.recent().filter(pk=recent_event.pk).exists()

    @pytest.mark.django_db
    def test_ip_address_manager(self):
        """Test ip_address manager."""
        event = SecurityEventFactory.create(ip_address="192.168.1.1")

        assert SecurityEvent.objects.ip_address("192.168.1.1").filter(pk=event.pk).exists()
