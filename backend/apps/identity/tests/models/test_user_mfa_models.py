"""
Identity user MFA model tests.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError

from apps.identity.models.user_mfa import UserMFA


class TestUserMFAModel:
    """Tests for UserMFA model."""

    @pytest.mark.django_db
    def test_create_user_mfa(self, user_mfa):
        """Test creating a user MFA."""
        assert user_mfa is not None
        assert user_mfa.user is not None
        assert user_mfa.method is not None

    @pytest.mark.django_db
    def test_user_mfa_uuid_generation(self, user_mfa):
        """Test UUID is generated on creation."""
        assert user_mfa.uuid is not None
        assert len(str(user_mfa.uuid)) == 36

    @pytest.mark.django_db
    def test_user_mfa_audit_fields(self, user_mfa):
        """Test audit fields are present."""
        assert user_mfa.created_at is not None
        assert user_mfa.updated_at is not None
        assert user_mfa.created_by is None
        assert user_mfa.updated_by is None

    @pytest.mark.django_db
    def test_user_mfa_soft_delete(self, user_mfa):
        """Test soft delete functionality."""
        assert user_mfa.deleted_at is None
        user_mfa.soft_delete()
        user_mfa = type(user_mfa).all_objects.get(pk=user_mfa.pk)
        assert user_mfa.deleted_at is not None

    @pytest.mark.django_db
    def test_user_mfa_unique_constraint(self, user_mfa):
        """Test unique constraint on user (OneToOne relation)."""
        with pytest.raises(IntegrityError):
            UserMFA.objects.create(
                user=user_mfa.user,
            )

    @pytest.mark.django_db
    def test_user_mfa_method_choices(self, user_mfa):
        """Test method field choices."""
        assert user_mfa.method in ["totp", "sms", "email", "backup"]

    @pytest.mark.django_db
    def test_user_mfa_is_enabled_default(self, user_mfa):
        """Test is_enabled field default value."""
        assert user_mfa.is_enabled is False

    @pytest.mark.django_db
    def test_user_mfa_secret_default(self, user_mfa):
        """Test secret property returns the stored totp_secret."""
        assert user_mfa.secret == user_mfa.totp_secret

    @pytest.mark.django_db
    def test_user_mfa_verified_at_default(self, user_mfa):
        """Test verified_at field default value."""
        assert user_mfa.verified_at is None

    @pytest.mark.django_db
    def test_user_mfa_last_used_at_default(self, user_mfa):
        """Test last_used_at field default value."""
        assert user_mfa.last_used_at is None

    @pytest.mark.django_db
    def test_user_mfa_str_representation(self, user_mfa):
        """Test string representation."""
        expected = f"{user_mfa.method} for {user_mfa.user.email}"
        assert str(user_mfa) == expected

    @pytest.mark.django_db
    def test_user_mfa_meta_db_table(self, user_mfa):
        """Test database table name."""
        assert user_mfa._meta.db_table == "identity_user_mfa"
