"""
Identity profile selector tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile
from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestProfileSelector:
    """Tests for ProfileSelector."""

    @pytest.mark.django_db
    def test_get_profile_by_id(self):
        """Test get_profile_by_id method."""
        profile = ProfileFactory.create()
        retrieved_profile = Profile.objects.get_by_id(profile.id)
        assert retrieved_profile.id == profile.id

    @pytest.mark.django_db
    def test_get_profile_by_user(self):
        """Test get_profile_by_user method."""
        user = UserFactory.create()
        profile = ProfileFactory.create(user=user)
        retrieved_profile = Profile.objects.get_profile_by_user(user.id)
        assert retrieved_profile.user.id == user.id

    @pytest.mark.django_db
    def test_list_profiles(self):
        """Test list_profiles method."""
        ProfileFactory.create_batch(5)
        profiles = Profile.objects.list_profiles()
        assert profiles.count() == 5

    @pytest.mark.django_db
    def test_list_profiles_with_pagination(self):
        """Test list_profiles with pagination."""
        ProfileFactory.create_batch(10)
        profiles = Profile.objects.list_profiles(limit=5, offset=0)
        assert profiles.count() == 5

    @pytest.mark.django_db
    def test_list_profiles_with_search(self):
        """Test list_profiles with search."""
        ProfileFactory.create(first_name="John", last_name="Doe")
        ProfileFactory.create(first_name="Jane", last_name="Smith")
        profiles = Profile.objects.list_profiles(search="John")
        assert profiles.count() == 1

    @pytest.mark.django_db
    def test_list_profiles_with_ordering(self):
        """Test list_profiles with ordering."""
        ProfileFactory.create(first_name="Zoe", last_name="Zebra")
        ProfileFactory.create(first_name="Alice", last_name="Apple")
        profiles = Profile.objects.list_profiles(order_by="first_name")
        assert profiles.first().first_name == "Alice"

    @pytest.mark.django_db
    def test_count_profiles(self):
        """Test count_profiles method."""
        ProfileFactory.create_batch(5)
        count = Profile.objects.count_profiles()
        assert count == 5

    @pytest.mark.django_db
    def test_get_profile_with_user(self):
        """Test get_profile_with_user method."""
        profile = ProfileFactory.create()
        retrieved_profile = Profile.objects.get_profile_with_user(profile.id)
        assert retrieved_profile.id == profile.id
        assert hasattr(retrieved_profile, "user")
