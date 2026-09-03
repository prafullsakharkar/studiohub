"""
Identity user selector tests.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from apps.identity.models.user import User
from apps.identity.tests.factories import ProfileFactory, UserFactory


class TestUserSelector:
    """Tests for UserSelector."""

    @pytest.mark.django_db
    def test_get_user_by_id(self):
        """Test get_user_by_id method."""
        user = UserFactory.create()
        retrieved_user = User.objects.get_by_id(user.id)
        assert retrieved_user.id == user.id

    @pytest.mark.django_db
    def test_get_user_by_email(self):
        """Test get_user_by_email method."""
        user = UserFactory.create(email="test@example.com")
        retrieved_user = User.objects.get_by_email("test@example.com")
        assert retrieved_user.email == user.email

    @pytest.mark.django_db
    def test_get_user_by_username(self):
        """Test get_user_by_username method (username == email)."""
        user = UserFactory.create(email="testuser@example.com")
        retrieved_user = User.objects.get_by_username("testuser@example.com")
        assert retrieved_user.email == user.email

    @pytest.mark.django_db
    def test_list_users(self):
        """Test list_users method."""
        UserFactory.create_batch(5)
        users = User.objects.list_users()
        assert users.count() == 5

    @pytest.mark.django_db
    def test_list_users_with_pagination(self):
        """Test list_users with pagination."""
        UserFactory.create_batch(10)
        users = User.objects.list_users(limit=5, offset=0)
        assert users.count() == 5

    @pytest.mark.django_db
    def test_list_users_with_search(self):
        """Test list_users with search."""
        UserFactory.create(email="john@example.com")
        UserFactory.create(email="jane@example.com")
        users = User.objects.list_users(search="john")
        assert users.count() == 1

    @pytest.mark.django_db
    def test_list_users_with_ordering(self):
        """Test list_users with ordering."""
        UserFactory.create(email="z@example.com")
        UserFactory.create(email="a@example.com")
        users = User.objects.list_users(order_by="email")
        assert users.first().email == "a@example.com"

    @pytest.mark.django_db
    def test_count_users(self):
        """Test count_users method."""
        UserFactory.create_batch(5)
        count = User.objects.count_users()
        assert count == 5

    @pytest.mark.django_db
    def test_get_user_with_profile(self):
        """Test get_user_with_profile method."""
        user = UserFactory.create()
        ProfileFactory.create(user=user)
        retrieved_user = User.objects.get_user_with_profile(user.id)
        assert retrieved_user.id == user.id
        assert hasattr(retrieved_user, "profile")

    @pytest.mark.django_db
    def test_get_user_with_last_login(self):
        """Test get_user_with_last_login method."""
        user = UserFactory.create(last_seen=timezone.now())
        retrieved_user = User.objects.get_user_with_last_login(user.id)
        assert retrieved_user.id == user.id
        assert retrieved_user.last_seen is not None
