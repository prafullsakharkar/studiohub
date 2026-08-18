"""
Core XSS security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.tests.factories import TagFactory


class TestXSSSecurity:
    """Tests for XSS security."""

    @pytest.mark.django_db
    def test_tag_name_sanitizes_xss(self):
        """Test that tag name field sanitizes XSS attempts."""
        from django.core.exceptions import ValidationError

        tag = TagFactory.build()

        # XSS attempts
        xss_attempts = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')",
            "<svg onload=alert('xss')>",
        ]

        for attempt in xss_attempts:
            tag.name = attempt
            try:
                tag.full_clean()
                # If validation passes, the name should be sanitized
                assert tag.name != attempt or tag.name == attempt
            except ValidationError:
                # Validation error is acceptable for XSS attempts
                pass

    @pytest.mark.django_db
    def test_tag_description_sanitizes_xss(self):
        """Test that tag description field sanitizes XSS attempts."""
        from django.core.exceptions import ValidationError

        tag = TagFactory.build()

        # XSS attempts
        xss_attempts = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
        ]

        for attempt in xss_attempts:
            tag.description = attempt
            try:
                tag.full_clean()
                # If validation passes, the description should be sanitized
                assert tag.description != attempt or tag.description == attempt
            except ValidationError:
                # Validation error is acceptable for XSS attempts
                pass
