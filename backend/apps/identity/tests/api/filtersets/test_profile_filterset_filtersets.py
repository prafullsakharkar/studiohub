"""
Identity profile filterset tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.profile import Profile
from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestProfileFilterSet:
    """Tests for ProfileFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_user(self):
        """Test filter by user."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        user = UserFactory.create()
        profile = ProfileFactory.create(user=user)

        filterset = ProfileFilterSet(
            data={"user": user.id},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().user.id == user.id

    @pytest.mark.django_db
    def test_filter_by_first_name(self):
        """Test filter by first_name."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        profile = ProfileFactory.create(first_name="John")

        filterset = ProfileFilterSet(
            data={"first_name": "John"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().first_name == "John"

    @pytest.mark.django_db
    def test_filter_by_last_name(self):
        """Test filter by last_name."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        profile = ProfileFactory.create(last_name="Doe")

        filterset = ProfileFilterSet(
            data={"last_name": "Doe"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().last_name == "Doe"

    @pytest.mark.django_db
    def test_filter_by_display_name(self):
        """Test filter by display_name."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        profile = ProfileFactory.create(display_name="John Doe")

        filterset = ProfileFilterSet(
            data={"display_name": "John Doe"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().display_name == "John Doe"

    @pytest.mark.django_db
    def test_filter_by_timezone(self):
        """Test filter by timezone."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        profile = ProfileFactory.create(timezone="UTC")

        filterset = ProfileFilterSet(
            data={"timezone": "UTC"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().timezone == "UTC"

    @pytest.mark.django_db
    def test_filter_by_language(self):
        """Test filter by language."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        profile = ProfileFactory.create(language="en")

        filterset = ProfileFilterSet(
            data={"language": "en"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1
        assert filterset.qs.first().language == "en"

    @pytest.mark.django_db
    def test_filter_by_search(self):
        """Test filter by search."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        ProfileFactory.create(first_name="John", last_name="Doe")
        ProfileFactory.create(first_name="Jane", last_name="Smith")

        filterset = ProfileFilterSet(
            data={"search": "john"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        assert filterset.qs.count() == 1

    @pytest.mark.django_db
    def test_filter_by_ordering(self):
        """Test filter by ordering."""
        from apps.identity.api.filtersets.user_preference import ProfileFilterSet

        ProfileFactory.create(first_name="Zoe", last_name="Zebra")
        ProfileFactory.create(first_name="Alice", last_name="Apple")

        filterset = ProfileFilterSet(
            data={"ordering": "first_name"},
            queryset=Profile.objects.all(),
        )

        assert filterset.is_valid()
        profiles = filterset.qs
        assert profiles.first().first_name == "Alice"
