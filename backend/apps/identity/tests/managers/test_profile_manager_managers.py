"""
Identity profile manager tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile
from apps.identity.tests.factories import ProfileFactory


class TestProfileManager:
    """Tests for ProfileManager."""

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_profile = ProfileFactory.create()
        assert Profile.objects.active().filter(pk=active_profile.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        inactive_profile = ProfileFactory.create()
        assert Profile.objects.inactive().filter(pk=inactive_profile.pk).exists()

    @pytest.mark.django_db
    def test_with_user_manager(self):
        """Test with_user manager."""
        profile = ProfileFactory.create()
        qs = Profile.objects.with_user()
        assert qs.filter(pk=profile.pk).exists()

    @pytest.mark.django_db
    def test_lookup_manager(self):
        """Test lookup manager."""
        ProfileFactory.create(first_name="John", last_name="Doe")

        # Lookup by first name
        assert Profile.objects.lookup("John").exists()

        # Lookup by last name
        assert Profile.objects.lookup("Doe").exists()

        # Lookup by full name
        assert Profile.objects.lookup("John Doe").exists()
