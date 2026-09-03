"""
Identity profile model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile


class TestProfileModel:
    """Tests for Profile model."""

    @pytest.mark.django_db
    def test_create_profile(self, profile):
        """Test creating a profile."""
        assert profile is not None
        assert profile.user is not None
        assert profile.first_name is not None
        assert profile.last_name is not None

    @pytest.mark.django_db
    def test_profile_uuid_generation(self, profile):
        """Test UUID is generated on creation."""
        assert profile.uuid is not None
        assert len(str(profile.uuid)) == 36

    @pytest.mark.django_db
    def test_profile_audit_fields(self, profile):
        """Test audit fields are present."""
        assert profile.created_at is not None
        assert profile.updated_at is not None
        assert profile.created_by is None
        assert profile.updated_by is None

    @pytest.mark.django_db
    def test_profile_soft_delete(self, profile):
        """Test soft delete functionality."""
        assert profile.deleted_at is None
        profile.soft_delete()
        profile = type(profile).all_objects.get(pk=profile.pk)
        assert profile.deleted_at is not None

    @pytest.mark.django_db
    def test_profile_unique_user(self, profile):
        """Test user field is unique."""
        with pytest.raises(Exception):
            Profile.objects.create(
                user=profile.user,
                first_name="Another",
                last_name="Profile",
            )

    @pytest.mark.django_db
    def test_profile_full_name(self, profile):
        """Test full_name property."""
        assert profile.full_name == f"{profile.first_name} {profile.last_name}".strip()

    @pytest.mark.django_db
    def test_profile_str_representation(self, profile):
        """Test string representation."""
        assert str(profile) == profile.display_name

    @pytest.mark.django_db
    def test_profile_display_name(self, profile):
        """Test display_name property."""
        assert profile.display_name is not None

    @pytest.mark.django_db
    def test_profile_timezone_choices(self, profile):
        """Test timezone field choices."""
        assert profile.timezone is not None

    @pytest.mark.django_db
    def test_profile_language_choices(self, profile):
        """Test language field choices."""
        assert profile.language is not None

    @pytest.mark.django_db
    def test_profile_preferences_default(self, profile):
        """Test preferences default value."""
        assert profile.preferences == {}

    @pytest.mark.django_db
    def test_profile_avatar_upload_to(self, profile):
        """Test avatar upload_to path."""
        assert "avatars/" in str(
            Profile._meta.get_field("avatar").upload_to
        )

    @pytest.mark.django_db
    def test_profile_meta_db_table(self, profile):
        """Test database table name."""
        assert profile._meta.db_table == "identity_profiles"

    @pytest.mark.django_db
    def test_profile_meta_no_ordering(self, profile):
        """Test default ordering."""
        assert profile._meta.ordering == []
