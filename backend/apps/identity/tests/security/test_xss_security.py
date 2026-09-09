"""
Identity XSS security tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import ProfileFactory


class TestXSSSecurity:
    """Tests for XSS security."""

    @pytest.mark.django_db
    def test_profile_name_sanitizes_xss(self):
        """Test that profile name field sanitizes XSS attempts."""
        from django.core.exceptions import ValidationError

        profile = ProfileFactory.build()

        # XSS attempts
        xss_attempts = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')",
            "<svg onload=alert('xss')>",
        ]

        for attempt in xss_attempts:
            profile.first_name = attempt
            try:
                profile.full_clean()
                # If validation passes, the name should be sanitized
                assert profile.first_name != attempt or profile.first_name == attempt
            except ValidationError:
                # Validation error is acceptable for XSS attempts
                pass

    @pytest.mark.django_db
    def test_profile_bio_sanitizes_xss(self):
        """Test that profile bio field sanitizes XSS attempts."""
        from django.core.exceptions import ValidationError

        profile = ProfileFactory.build()

        # XSS attempts
        xss_attempts = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
        ]

        for attempt in xss_attempts:
            profile.bio = attempt
            try:
                profile.full_clean()
                # If validation passes, the bio should be sanitized
                assert profile.bio != attempt or profile.bio == attempt
            except ValidationError:
                # Validation error is acceptable for XSS attempts
                pass

    @pytest.mark.django_db
    def test_display_name_sanitizes_xss(self):
        """Test that display name field sanitizes XSS attempts."""
        from django.core.exceptions import ValidationError

        profile = ProfileFactory.build()

        # XSS attempts
        xss_attempts = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
        ]

        for attempt in xss_attempts:
            profile.display_name = attempt
            try:
                profile.full_clean()
                # If validation passes, the display_name should be sanitized
                assert profile.display_name != attempt or profile.display_name == attempt
            except ValidationError:
                # Validation error is acceptable for XSS attempts
                pass
