"""
Identity user manager tests.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserManager:
    """Tests for UserManager."""

    @pytest.mark.django_db
    def test_create_user(self):
        """Test creating a regular user."""
        user = User.objects.create_user(
            email="test@example.com",
            password="password123",
        )
        assert user is not None
        assert user.email == "test@example.com"
        assert user.check_password("password123")
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False

    @pytest.mark.django_db
    def test_create_superuser(self):
        """Test creating a superuser."""
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="password123",
        )
        assert user is not None
        assert user.email == "admin@example.com"
        assert user.check_password("password123")
        assert user.is_active is True
        assert user.is_staff is True
        assert user.is_superuser is True

    @pytest.mark.django_db
    def test_active_manager(self):
        """Test active manager."""
        active_user = UserFactory.create(is_active=True)
        inactive_user = UserFactory.create(is_active=False)

        assert User.objects.active().filter(pk=active_user.pk).exists()
        assert not User.objects.active().filter(pk=inactive_user.pk).exists()

    @pytest.mark.django_db
    def test_inactive_manager(self):
        """Test inactive manager."""
        active_user = UserFactory.create(is_active=True)
        inactive_user = UserFactory.create(is_active=False)

        assert not User.objects.inactive().filter(pk=active_user.pk).exists()
        assert User.objects.inactive().filter(pk=inactive_user.pk).exists()

    @pytest.mark.django_db
    def test_staff_manager(self):
        """Test staff manager."""
        regular_user = UserFactory.create(is_staff=False)
        staff_user = UserFactory.create(is_staff=True)

        assert not User.objects.staff().filter(pk=regular_user.pk).exists()
        assert User.objects.staff().filter(pk=staff_user.pk).exists()

    @pytest.mark.django_db
    def test_superusers_manager(self):
        """Test superusers manager."""
        regular_user = UserFactory.create(is_superuser=False)
        superuser = UserFactory.create(is_superuser=True)

        assert not User.objects.superusers().filter(pk=regular_user.pk).exists()
        assert User.objects.superusers().filter(pk=superuser.pk).exists()

    @pytest.mark.django_db
    def test_with_last_seen_manager(self):
        """Test with_last_seen manager."""
        UserFactory.create(last_seen=None)
        user_with_last_seen = UserFactory.create(last_seen=timezone.now())

        qs = User.objects.with_last_seen()
        assert qs.filter(pk=user_with_last_seen.pk).exists()

    @pytest.mark.django_db
    def test_lookup_manager(self):
        """Test lookup manager."""
        user = UserFactory.create(email="test@example.com")

        # Lookup by email
        assert User.objects.lookup("test@example.com").exists()

        # Lookup by username (if applicable)
        assert User.objects.lookup(user.username).exists()

    @pytest.mark.django_db
    def test_get_by_natural_key(self):
        """Test get_by_natural_key method."""
        user = UserFactory.create(email="test@example.com")

        retrieved_user = User.objects.get_by_natural_key("test@example.com")
        assert retrieved_user.pk == user.pk
