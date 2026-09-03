"""
Identity login attempt serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import LoginAttemptFactory, UserFactory


class TestLoginAttemptSerializer:
    """Tests for LoginAttemptSerializer."""

    @pytest.mark.django_db
    def test_login_attempt_serializer_fields(self):
        """Test login attempt serializer fields."""
        from apps.identity.api.serializers.login_attempt.base import LoginAttemptSerializer

        attempt = LoginAttemptFactory.create()
        serializer = LoginAttemptSerializer(attempt)

        assert "id" in serializer.data
        assert "user" in serializer.data
        assert "ip_address" in serializer.data
        assert "user_agent" in serializer.data
        assert "success" in serializer.data
        assert "reason" in serializer.data
        assert "attempted_at" in serializer.data

    @pytest.mark.django_db
    def test_login_attempt_serializer_create(self):
        """Test login attempt serializer create."""
        from apps.identity.api.serializers.login_attempt.create import (
            LoginAttemptCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
            "success": True,
            "reason": "success",
        }

        serializer = LoginAttemptCreateSerializer(data=data)
        assert serializer.is_valid()

        attempt = serializer.save()
        assert attempt.success is True

    @pytest.mark.django_db
    def test_login_attempt_serializer_update(self):
        """Test login attempt serializer update."""
        from apps.identity.api.serializers.login_attempt.update import (
            LoginAttemptUpdateSerializer,
        )

        attempt = LoginAttemptFactory.create()

        data = {
            "success": False,
        }

        serializer = LoginAttemptUpdateSerializer(attempt, data=data, partial=True)
        assert serializer.is_valid()

        attempt = serializer.save()
        assert attempt.success is False

    @pytest.mark.django_db
    def test_login_attempt_serializer_ip_address_validation(self):
        """Test login attempt serializer ip_address validation."""
        from apps.identity.api.serializers.login_attempt.create import (
            LoginAttemptCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "ip_address": "invalid-ip",
            "user_agent": "Mozilla/5.0",
            "success": True,
            "reason": "success",
        }

        serializer = LoginAttemptCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "ip_address" in serializer.errors

    @pytest.mark.django_db
    def test_login_attempt_serializer_reason_validation(self):
        """Test login attempt serializer reason validation."""
        from apps.identity.api.serializers.login_attempt.create import (
            LoginAttemptCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
            "success": True,
            "reason": "invalid-reason",
        }

        serializer = LoginAttemptCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "reason" in serializer.errors
