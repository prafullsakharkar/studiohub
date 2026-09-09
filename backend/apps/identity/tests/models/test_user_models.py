"""
Identity user model tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserModel:
    """Tests for User model."""

    @pytest.mark.django_db
    def test_create_user(self, user):
        """Test creating a user."""
        assert user is not None
        assert user.email is not None
        assert user.is_active is True
        assert user.is_staff is False

    @pytest.mark.django_db
    def test_user_uuid_generation(self, user):
        """Test UUID is generated on creation."""
        assert user.uuid is not None
        assert len(str(user.uuid)) == 36

    @pytest.mark.django_db
    def test_user_audit_fields(self, user):
        """Test audit fields are present."""
        assert user.created_at is not None
        assert user.updated_at is not None
        assert user.created_by is None
        assert user.updated_by is None

    @pytest.mark.django_db
    def test_user_soft_delete(self, user):
        """Test soft delete functionality."""
        assert user.deleted_at is None
        user.soft_delete()
        user = type(user).all_objects.get(pk=user.pk)
        assert user.deleted_at is not None

    @pytest.mark.django_db
    def test_user_unique_email(self, user):
        """Test email field is unique."""
        with pytest.raises(IntegrityError):
            User.objects.create(
                email=user.email,
                is_active=True,
            )

    @pytest.mark.django_db
    def test_user_email_normalization(self, user):
        """Test email normalization."""
        user.email = "TEST@EXAMPLE.COM"
        user.clean()
        assert user.email == "test@example.com"

    @pytest.mark.django_db
    def test_user_email_validation(self, user):
        """Test email field validation."""
        user.email = "invalid-email"
        with pytest.raises(ValidationError):
            user.full_clean()

    @pytest.mark.django_db
    def test_user_str_representation(self, user):
        """Test string representation."""
        assert str(user) == user.display_name

    @pytest.mark.django_db
    def test_user_get_full_name(self, user, profile):
        """Test get_full_name method."""
        assert user.get_full_name() == user.full_name

    @pytest.mark.django_db
    def test_user_get_short_name(self, user, profile):
        """Test get_short_name method."""
        short_name = user.get_short_name()
        assert short_name is not None

    @pytest.mark.django_db
    def test_user_display_name_with_profile(self, user, profile):
        """Test display_name property with profile."""
        assert user.display_name == profile.display_name

    @pytest.mark.django_db
    def test_user_display_name_without_profile(self):
        """Test display_name property without profile."""
        user = UserFactory.create()
        assert user.display_name == user.email

    @pytest.mark.django_db
    def test_user_full_name_with_profile(self, user, profile):
        """Test full_name property with profile."""
        assert user.full_name == profile.full_name

    @pytest.mark.django_db
    def test_user_full_name_without_profile(self):
        """Test full_name property without profile."""
        user = UserFactory.create()
        assert user.full_name == user.email

    @pytest.mark.django_db
    def test_user_is_active_manager(self, user):
        """Test active manager."""
        assert User.objects.active().filter(pk=user.pk).exists()

    @pytest.mark.django_db
    def test_user_is_staff_manager(self, user):
        """Test staff manager."""
        user.is_staff = True
        user.save()
        assert User.objects.staff().filter(pk=user.pk).exists()

    @pytest.mark.django_db
    def test_user_is_superuser_manager(self, user):
        """Test superuser manager."""
        user.is_superuser = True
        user.save()
        assert User.objects.superusers().filter(pk=user.pk).exists()

    @pytest.mark.django_db
    def test_user_last_seen_manager(self, user):
        """Test last_seen manager."""
        user.last_seen = timezone.now()
        user.save()
        assert User.objects.with_last_seen().filter(pk=user.pk).exists()

    @pytest.mark.django_db
    def test_user_ordering(self, user):
        """Test default ordering."""
        users = User.objects.all()
        if users.count() > 1:
            for i in range(len(users) - 1):
                assert users[i].email <= users[i + 1].email

    @pytest.mark.django_db
    def test_user_meta_db_table(self, user):
        """Test database table name."""
        assert user._meta.db_table == "identity_users"

    @pytest.mark.django_db
    def test_user_meta_ordering(self, user):
        """Test default ordering."""
        assert user._meta.ordering == ["email"]
