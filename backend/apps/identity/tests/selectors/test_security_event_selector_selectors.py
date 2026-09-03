"""
Identity security event selector tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.security_event import SecurityEvent
from apps.identity.tests.factories import SecurityEventFactory, UserFactory


class TestSecurityEventSelector:
    """Tests for SecurityEventSelector."""

    @pytest.mark.django_db
    def test_get_security_event_by_id(self):
        """Test get_security_event_by_id method."""
        event = SecurityEventFactory.create()
        retrieved_event = SecurityEvent.objects.get_by_id(event.id)
        assert retrieved_event.id == event.id

    @pytest.mark.django_db
    def test_list_security_events(self):
        """Test list_security_events method."""
        SecurityEventFactory.create_batch(5)
        events = SecurityEvent.objects.list_security_events()
        assert events.count() == 5

    @pytest.mark.django_db
    def test_list_security_events_with_pagination(self):
        """Test list_security_events with pagination."""
        SecurityEventFactory.create_batch(10)
        events = SecurityEvent.objects.list_security_events(limit=5, offset=0)
        assert events.count() == 5

    @pytest.mark.django_db
    def test_list_security_events_with_user(self):
        """Test list_security_events with user filter."""
        user = UserFactory.create()
        SecurityEventFactory.create_batch(3, user=user)
        events = SecurityEvent.objects.list_security_events(user_id=user.id)
        assert events.count() == 3

    @pytest.mark.django_db
    def test_list_security_events_with_type_filter(self):
        """Test list_security_events with type filter."""
        SecurityEventFactory.create_batch(3, event_type="login")
        SecurityEventFactory.create_batch(2, event_type="logout")
        login_events = SecurityEvent.objects.list_security_events(event_type="login")
        logout_events = SecurityEvent.objects.list_security_events(event_type="logout")
        assert login_events.count() == 3
        assert logout_events.count() == 2

    @pytest.mark.django_db
    def test_list_security_events_with_date_range(self):
        """Test list_security_events with date range."""
        SecurityEventFactory.create_batch(3, occurred_at=timezone.now() - timedelta(days=1))
        SecurityEventFactory.create_batch(2, occurred_at=timezone.now())
        recent_events = SecurityEvent.objects.list_security_events(
            start_date=timezone.now() - timedelta(days=2),
            end_date=timezone.now(),
        )
        assert recent_events.count() == 5

    @pytest.mark.django_db
    def test_count_security_events(self):
        """Test count_security_events method."""
        SecurityEventFactory.create_batch(5)
        count = SecurityEvent.objects.count_security_events()
        assert count == 5

    @pytest.mark.django_db
    def test_get_security_event_with_user(self):
        """Test get_security_event_with_user method."""
        event = SecurityEventFactory.create()
        retrieved_event = SecurityEvent.objects.get_security_event_with_user(event.id)
        assert retrieved_event.id == event.id
        assert hasattr(retrieved_event, "user")
