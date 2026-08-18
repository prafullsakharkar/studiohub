"""
Identity user serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserSerializer:
    """Tests for UserSerializer."""

    @pytest.mark.django_db
    def test_user_serializer_fields(self):
        """Test user serializer fields."""
        from apps.identity.api.serializers.user.base import UserSerializer

        user = UserFactory.create()
        serializer = UserSerializer(user)

        assert "id" in serializer.data
        assert "email" in serializer.data
        assert "is_active" in serializer.data
        assert "is_staff" in serializer.data
        assert "is_email_verified" in serializer.data
        assert "last_seen" in serializer.data
        assert "created_at" in serializer.data
        assert "updated_at" in serializer.data

    @pytest.mark.django_db
    def test_user_serializer_create(self):
        """Test user serializer create."""
        from apps.identity.api.serializers.user.create import UserCreateSerializer

        data = {
            "email": "new@example.com",
            "password": "Password123!",
        }

        serializer = UserCreateSerializer(data=data)
        assert serializer.is_valid()

        user = serializer.save()
        assert user.email == "new@example.com"
        assert user.check_password("Password123!")

    @pytest.mark.django_db
    def test_user_serializer_update(self):
        """Test user serializer update."""
        from apps.identity.api.serializers.user.update import UserUpdateSerializer

        user = UserFactory.create()

        data = {
            "email": "updated@example.com",
        }

        serializer = UserUpdateSerializer(user, data=data, partial=True)
        assert serializer.is_valid()

        user = serializer.save()
        assert user.email == "updated@example.com"

    @pytest.mark.django_db
    def test_user_serializer_password_validation(self):
        """Test user serializer password validation."""
        from apps.identity.api.serializers.user.create import UserCreateSerializer

        data = {
            "email": "new@example.com",
            "password": "weak",
        }

        serializer = UserCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "password" in serializer.errors

    @pytest.mark.django_db
    def test_user_serializer_email_validation(self):
        """Test user serializer email validation."""
        from apps.identity.api.serializers.user.create import UserCreateSerializer

        data = {
            "email": "invalid-email",
            "password": "Password123!",
        }

        serializer = UserCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "email" in serializer.errors

    @pytest.mark.django_db
    def test_user_serializer_read_only_fields(self):
        """Test user serializer read-only fields."""
        from apps.identity.api.serializers.user.base import UserSerializer

        user = UserFactory.create(is_staff=True)

        serializer = UserSerializer(user)
        assert serializer.data["is_staff"] is True
