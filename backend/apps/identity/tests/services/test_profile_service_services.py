"""
Identity profile service tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile
from apps.identity.services.profile import ProfileService
from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestProfileService:
    """Tests for ProfileService."""

    @pytest.mark.django_db
    def test_create_profile_success(self):
        """Test successful profile creation."""
        user = UserFactory.create()

        result = ProfileService.create(
            user=user,
            first_name="John",
            last_name="Doe",
        )

        assert result is not None
        assert result.user == user
        assert result.first_name == "John"
        assert result.last_name == "Doe"

    @pytest.mark.django_db
    def test_create_profile_defaults_display_name(self):
        """Test display_name is derived from the profile name."""
        user = UserFactory.create()

        result = ProfileService.create(
            user=user,
            first_name="John",
            last_name="Doe",
        )

        assert result.display_name == "John Doe"

    @pytest.mark.django_db
    def test_update_profile_success(self):
        """Test successful profile update."""
        profile = ProfileFactory.create()

        result = ProfileService.update_profile(
            profile,
            first_name="Updated",
        )

        assert result is not None
        assert result.first_name == "Updated"

    @pytest.mark.django_db
    def test_delete_profile_success(self):
        """Test successful profile deletion."""
        profile = ProfileFactory.create()

        result = ProfileService.delete(profile)

        assert result is None
        # Soft-delete semantics: the record is flagged, not physically removed.
        assert profile.is_deleted is True
