"""
Identity authentication service tests.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.identity.tests.factories import UserFactory


class TestAuthenticationService:
    """Tests for authentication module functions."""

    @pytest.mark.django_db
    def test_login_success(self):
        """Test successful login."""
        user = UserFactory.create()
        user.set_password("Password123!")
        user.save()

        from apps.identity.services.authentication import login_user

        result = login_user(user, "Password123!")
        assert result is not None
        assert result == user

    @pytest.mark.django_db
    def test_login_failure(self):
        """Test login with a None user returns None."""
        from apps.identity.services.authentication import login_user

        result = login_user(None, "WrongPassword")
        assert result is None

    @pytest.mark.django_db
    def test_logout_success(self):
        """Test successful logout."""
        user = UserFactory.create()
        from apps.identity.services.authentication import logout_user

        result = logout_user(user)
        assert result is True

    @pytest.mark.django_db
    def test_change_password_success(self):
        """Test successful password change."""
        user = UserFactory.create()
        user.set_password("Password123!")
        user.save()

        from apps.identity.services.authentication import change_password

        result = change_password(user, "Password123!", "NewPassword123!")
        assert result is True
        user.refresh_from_db()
        assert user.check_password("NewPassword123!")

    @pytest.mark.django_db
    def test_change_password_failure(self):
        """Test failed password change."""
        user = UserFactory.create()
        user.set_password("Password123!")
        user.save()

        from apps.identity.services.authentication import change_password

        result = change_password(user, "WrongPassword", "NewPassword123!")
        assert result is False

    @pytest.mark.django_db
    def test_reset_password_success(self):
        """Test successful password reset."""
        user = UserFactory.create()

        with patch(
            "apps.identity.services.authentication.send_password_reset_email"
        ) as mock_send:
            mock_send.return_value = True
            from apps.identity.services.authentication import reset_password

            result = reset_password(user.email)
            assert result is True

    @pytest.mark.django_db
    def test_verify_email_success(self):
        """Test successful email verification."""
        user = UserFactory.create(is_email_verified=False)

        with patch(
            "apps.identity.services.authentication.verify_email_token"
        ) as mock_verify:
            mock_verify.return_value = user
            from apps.identity.services.authentication import verify_email

            result = verify_email(user.email, "valid-token")
            assert result is True

    @pytest.mark.django_db
    def test_verify_email_failure(self):
        """Test failed email verification."""
        user = UserFactory.create(is_email_verified=False)

        with patch(
            "apps.identity.services.authentication.verify_email_token"
        ) as mock_verify:
            mock_verify.return_value = None
            from apps.identity.services.authentication import verify_email

            result = verify_email(user.email, "invalid-token")
            assert result is False
