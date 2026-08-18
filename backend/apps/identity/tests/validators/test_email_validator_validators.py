"""
Identity email validator tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.identity.validators.email import validate_email


class TestEmailValidator:
    """Tests for email validator."""

    @pytest.mark.django_db
    def test_valid_email(self):
        """Test valid email addresses."""
        valid_emails = [
            "test@example.com",
            "user.name@example.com",
            "user+tag@example.com",
            "user_name@example.co.uk",
            "123@example.com",
        ]

        for email in valid_emails:
            try:
                validate_email(email)
            except ValidationError:
                pytest.fail(f"Valid email {email} raised ValidationError")

    @pytest.mark.django_db
    def test_invalid_email(self):
        """Test invalid email addresses."""
        invalid_emails = [
            "invalid-email",
            "test@",
            "@example.com",
            "test@example",
            "test@.com",
            "test@example..com",
        ]

        for email in invalid_emails:
            with pytest.raises(ValidationError):
                validate_email(email)

    @pytest.mark.django_db
    def test_email_with_spaces(self):
        """Test email with spaces."""
        with pytest.raises(ValidationError):
            validate_email("test @example.com")

    @pytest.mark.django_db
    def test_email_with_special_characters(self):
        """Test email with special characters."""
        valid_emails = [
            "test!#$%&'*+-/=?^_`{|}~@example.com",
        ]

        for email in valid_emails:
            try:
                validate_email(email)
            except ValidationError:
                pytest.fail(f"Valid email {email} raised ValidationError")
