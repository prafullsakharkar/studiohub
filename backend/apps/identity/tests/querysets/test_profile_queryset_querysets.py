"""
Identity profile queryset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile
from apps.identity.models.user import User
from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestProfileQuerySet:
    """Tests for ProfileQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_profile = ProfileFactory.create()
        assert Profile.objects.active().filter(pk=active_profile.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        inactive_profile = ProfileFactory.create()
        assert Profile.objects.inactive().filter(pk=inactive_profile.pk).exists()

    @pytest.mark.django_db
    def test_with_user_queryset(self):
        """Test with_user queryset."""
        profile = ProfileFactory.create()
        qs = Profile.objects.with_user()
        assert qs.filter(pk=profile.pk).exists()

    @pytest.mark.django_db
    def test_lookup_queryset(self):
        """Test lookup queryset."""
        profile = ProfileFactory.create(first_name="John", last_name="Doe")

        assert Profile.objects.lookup("John").exists()
        assert Profile.objects.lookup("Doe").exists()
        assert Profile.objects.lookup("John Doe").exists()

    @pytest.mark.django_db
    def test_by_user_queryset(self):
        """Test by_user queryset."""
        user = UserFactory.create()
        profile = ProfileFactory.create(user=user)

        assert Profile.objects.by_user(user).exists()

    @pytest.mark.django_db
    def test_order_by_name_queryset(self):
        """Test order_by_name queryset."""
        profile1 = ProfileFactory.create(first_name="Zoe", last_name="Zebra")
        profile2 = ProfileFactory.create(first_name="Alice", last_name="Apple")

        qs = Profile.objects.order_by_name()
        profiles = list(qs)

        if len(profiles) >= 2:
            assert profiles[0].full_name <= profiles[1].full_name
