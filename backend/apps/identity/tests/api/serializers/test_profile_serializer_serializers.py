"""
Identity profile serializer tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestProfileSerializer:
    """Tests for ProfileSerializer."""

    @pytest.mark.django_db
    def test_profile_serializer_fields(self):
        """Test profile serializer fields."""
        from apps.identity.api.serializers.user_preference.base import ProfileSerializer

        profile = ProfileFactory.create()
        serializer = ProfileSerializer(profile)

        assert "id" in serializer.data
        assert "user" in serializer.data
        assert "first_name" in serializer.data
        assert "last_name" in serializer.data
        assert "display_name" in serializer.data
        assert "avatar" in serializer.data
        assert "phone" in serializer.data
        assert "bio" in serializer.data
        assert "timezone" in serializer.data
        assert "language" in serializer.data
        assert "preferences" in serializer.data

    @pytest.mark.django_db
    def test_profile_serializer_create(self):
        """Test profile serializer create."""
        from apps.identity.api.serializers.user_preference.create import (
            ProfileCreateSerializer,
        )

        user = UserFactory.create()

        data = {
            "user": user.id,
            "first_name": "John",
            "last_name": "Doe",
            "display_name": "John Doe",
        }

        serializer = ProfileCreateSerializer(data=data)
        assert serializer.is_valid()

        profile = serializer.save()
        assert profile.first_name == "John"
        assert profile.last_name == "Doe"

    @pytest.mark.django_db
    def test_profile_serializer_update(self):
        """Test profile serializer update."""
        from apps.identity.api.serializers.user_preference.update import (
            ProfileUpdateSerializer,
        )

        profile = ProfileFactory.create()

        data = {
            "first_name": "Updated",
        }

        serializer = ProfileUpdateSerializer(profile, data=data, partial=True)
        assert serializer.is_valid()

        profile = serializer.save()
        assert profile.first_name == "Updated"

    @pytest.mark.django_db
    def test_profile_serializer_avatar_upload(self):
        """Test profile serializer avatar upload."""
        import base64

        from django.core.files.uploadedfile import SimpleUploadedFile

        from apps.identity.api.serializers.user_preference.update import (
            ProfileUpdateSerializer,
        )

        profile = ProfileFactory.create()

        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )

        data = {
            "avatar": SimpleUploadedFile(
                "avatar.png",
                png,
                content_type="image/png",
            ),
        }

        serializer = ProfileUpdateSerializer(profile, data=data, partial=True)
        assert serializer.is_valid()

    @pytest.mark.django_db
    def test_profile_serializer_timezone_validation(self):
        """Test profile serializer timezone validation."""
        from apps.identity.api.serializers.user_preference.create import (
            ProfileCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "first_name": "John",
            "last_name": "Doe",
            "timezone": "Invalid/Timezone",
        }

        serializer = ProfileCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "timezone" in serializer.errors

    @pytest.mark.django_db
    def test_profile_serializer_language_validation(self):
        """Test profile serializer language validation."""
        from apps.identity.api.serializers.user_preference.create import (
            ProfileCreateSerializer,
        )

        data = {
            "user": UserFactory.create().id,
            "first_name": "John",
            "last_name": "Doe",
            "language": "invalid",
        }

        serializer = ProfileCreateSerializer(data=data)
        assert not serializer.is_valid()
        assert "language" in serializer.errors
