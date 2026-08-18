"""
Identity user queryset tests.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserQuerySet:
    """Tests for UserQuerySet."""

    @pytest.mark.django_db
    def test_active_queryset(self):
        """Test active queryset."""
        active_user = UserFactory.create(is_active=True)
        inactive_user = UserFactory.create(is_active=False)

        assert User.objects.active().filter(pk=active_user.pk).exists()
        assert not User.objects.active().filter(pk=inactive_user.pk).exists()

    @pytest.mark.django_db
    def test_inactive_queryset(self):
        """Test inactive queryset."""
        active_user = UserFactory.create(is_active=True)
        inactive_user = UserFactory.create(is_active=False)

        assert not User.objects.inactive().filter(pk=active_user.pk).exists()
        assert User.objects.inactive().filter(pk=inactive_user.pk).exists()

    @pytest.mark.django_db
    def test_staff_queryset(self):
        """Test staff queryset."""
        regular_user = UserFactory.create(is_staff=False)
        staff_user = UserFactory.create(is_staff=True)

        assert not User.objects.staff().filter(pk=regular_user.pk).exists()
        assert User.objects.staff().filter(pk=staff_user.pk).exists()

    @pytest.mark.django_db
    def test_superusers_queryset(self):
        """Test superusers queryset."""
        regular_user = UserFactory.create(is_superuser=False)
        superuser = UserFactory.create(is_superuser=True)

        assert not User.objects.superusers().filter(pk=regular_user.pk).exists()
        assert User.objects.superusers().filter(pk=superuser.pk).exists()

    @pytest.mark.django_db
    def test_with_last_seen_queryset(self):
        """Test with_last_seen queryset."""
        user = UserFactory.create(last_seen=None)
        user_with_last_seen = UserFactory.create(last_seen=timezone.now())

        qs = User.objects.with_last_seen()
        assert qs.filter(pk=user_with_last_seen.pk).exists()

    @pytest.mark.django_db
    def test_lookup_queryset(self):
        """Test lookup queryset."""
        user = UserFactory.create(email="test@example.com")

        assert User.objects.lookup("test@example.com").exists()
        assert User.objects.lookup(user.username).exists()

    @pytest.mark.django_db
    def test_by_email_queryset(self):
        """Test by_email queryset."""
        user = UserFactory.create(email="test@example.com")

        assert User.objects.by_email("test@example.com").exists()

    @pytest.mark.django_db
    def test_by_username_queryset(self):
        """Test by_username queryset."""
        user = UserFactory.create(email="testuser@example.com")

        assert User.objects.by_username("testuser@example.com").exists()
        assert User.objects.by_username(user.username).exists()

    @pytest.mark.django_db
    def test_recent_queryset(self):
        """Test recent queryset."""
        recent_user = UserFactory.create(last_seen=timezone.now())
        assert User.objects.recent().filter(pk=recent_user.pk).exists()

    @pytest.mark.django_db
    def test_order_by_last_seen_queryset(self):
        """Test order_by_last_seen queryset."""
        user1 = UserFactory.create(last_seen=timezone.now() - timedelta(days=1))
        user2 = UserFactory.create(last_seen=timezone.now())

        qs = User.objects.order_by_last_seen()
        users = list(qs)

        if len(users) >= 2:
            assert users[0].last_seen >= users[1].last_seen
