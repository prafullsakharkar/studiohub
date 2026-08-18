"""
Identity security event serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.user import User
from apps.identity.tests.factories import SecurityEventFactory, UserFactory


class TestSecurityEventSerializer:
    """Tests for SecurityEventSerializer."""

    @pytest.mark.django_db
    def test_security_event_serializer_fields(self):
        """Test security event serializer fields."""
        from apps.identity.api.serializers.user_preference.base import (
            SecurityEventSerializer,
        )

        event = SecurityEventFactory.create()
        serializer = SecurityEventSerializer(event)

        assert "id" in serializer.data
        assert "user" in serializer.data
        assert "event_type" in serializer.data
        assert "ip_address" in serializer.data
        assert "user_agent" in serializer.data
        assert "metadata" in serializer.data
        assert "occurred_at" in serializer.data

    @pytest.mark.django_db
    def test_security_event_serializer_create(self):
        """Test security event serializer create."""
        from apps.identity.api.serializers.user_preference.create import (
            SecurityEventCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "event_type": "login_success",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
            "metadata": {},
        }

        serializer = SecurityEventCreateSerializer(data=data)
        assert serializer.is_valid()

        event = serializer.save()
        assert event.event_type == "login_success"

    @pytest.mark.django_db
    def test_security_event_serializer_update(self):
        """Test security event serializer update."""
        from apps.identity.api.serializers.user_preference.update import (
            SecurityEventUpdateSerializer,
        )

        event = SecurityEventFactory.create()

        data = {
            "event_type": "login_failed",
        }

        serializer = SecurityEventUpdateSerializer(event, data=data, partial=True)
        assert serializer.is_valid()

        event = serializer.save()
        assert event.event_type == "login_failed"

    @pytest.mark.django_db
    def test_security_event_serializer_event_type_validation(self):
        """Test security event serializer event_type validation."""
        from apps.identity.api.serializers.user_preference.create import (
            SecurityEventCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "event_type": "invalid-event",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
            "metadata": {},
        }

        serializer = SecurityEventCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "event_type" in serializer.errors

    @pytest.mark.django_db
    def test_security_event_serializer_ip_address_validation(self):
        """Test security event serializer ip_address validation."""
        from apps.identity.api.serializers.user_preference.create import (
            SecurityEventCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "event_type": "login",
            "ip_address": "invalid-ip",
            "user_agent": "Mozilla/5.0",
            "metadata": {},
        }

        serializer = SecurityEventCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "ip_address" in serializer.errors
