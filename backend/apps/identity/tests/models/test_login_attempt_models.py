"""
Identity login attempt model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.login_attempt import LoginAttempt


class TestLoginAttemptModel:
    """Tests for LoginAttempt model."""

    @pytest.mark.django_db
    def test_create_login_attempt(self, login_attempt):
        """Test creating a login attempt."""
        assert login_attempt is not None
        assert login_attempt.user is not None
        assert login_attempt.ip_address is not None
        assert login_attempt.success is False

    @pytest.mark.django_db
    def test_login_attempt_uuid_generation(self, login_attempt):
        """Test UUID is generated on creation."""
        assert login_attempt.uuid is not None
        assert len(str(login_attempt.uuid)) == 36

    @pytest.mark.django_db
    def test_login_attempt_audit_fields(self, login_attempt):
        """Test audit fields are present."""
        assert login_attempt.created_at is not None
        assert login_attempt.updated_at is not None
        assert login_attempt.created_by is None
        assert login_attempt.updated_by is None

    @pytest.mark.django_db
    def test_login_attempt_soft_delete(self, login_attempt):
        """Test soft delete functionality."""
        assert login_attempt.deleted_at is None
        login_attempt.soft_delete()
        login_attempt = type(login_attempt).all_objects.get(pk=login_attempt.pk)
        assert login_attempt.deleted_at is not None

    @pytest.mark.django_db
    def test_login_attempt_ip_address(self, login_attempt):
        """Test ip_address field."""
        assert login_attempt.ip_address is not None

    @pytest.mark.django_db
    def test_login_attempt_user_agent(self, login_attempt):
        """Test user_agent field."""
        assert login_attempt.user_agent is not None

    @pytest.mark.django_db
    def test_login_attempt_success_default(self, login_attempt):
        """Test success field default value."""
        assert login_attempt.success is False

    @pytest.mark.django_db
    def test_login_attempt_reason_choices(self, login_attempt):
        """Test reason field choices."""
        assert login_attempt.reason in [
            "invalid_credentials",
            "account_locked",
            "mfa_required",
            "success",
        ]

    @pytest.mark.django_db
    def test_login_attempt_attempted_at(self, login_attempt):
        """Test attempted_at field."""
        assert login_attempt.attempted_at is not None

    @pytest.mark.django_db
    def test_login_attempt_str_representation(self, login_attempt):
        """Test string representation."""
        expected = f"Login attempt for {login_attempt.user.email}"
        assert str(login_attempt) == expected

    @pytest.mark.django_db
    def test_login_attempt_meta_db_table(self, login_attempt):
        """Test database table name."""
        assert login_attempt._meta.db_table == "identity_login_attempts"
