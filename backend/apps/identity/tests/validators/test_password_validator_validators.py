"""
Identity password validator tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.identity.validators.password import validate_password


class TestPasswordValidator:
    """Tests for password validator."""

    @pytest.mark.django_db
    def test_valid_password(self):
        """Test valid passwords."""
        valid_passwords = [
            "Password123!",
            "MyP@ssw0rd",
            "SecurePass123!",
            "Test1234@",
        ]

        for password in valid_passwords:
            try:
                validate_password(password)
            except ValidationError:
                pytest.fail(f"Valid password {password} raised ValidationError")

    @pytest.mark.django_db
    def test_invalid_password(self):
        """Test invalid passwords."""
        invalid_passwords = [
            "password",  # too short
            "PASSWORD",  # no lowercase
            "password123",  # no uppercase
            "Password",  # no number
            "Password!",  # no special character
            "12345678",  # no letters
        ]

        for password in invalid_passwords:
            with pytest.raises(ValidationError):
                validate_password(password)

    @pytest.mark.django_db
    def test_password_minimum_length(self):
        """Test password minimum length requirement."""
        with pytest.raises(ValidationError):
            validate_password("Pass1!")

    @pytest.mark.django_db
    def test_password_maximum_length(self):
        """Test password maximum length requirement."""
        long_password = "A" * 129 + "1!"
        with pytest.raises(ValidationError):
            validate_password(long_password)

    @pytest.mark.django_db
    def test_password_no_spaces(self):
        """Test password with spaces."""
        with pytest.raises(ValidationError):
            validate_password("Pass word123!")
