"""
Core base admin tests.
"""

from __future__ import annotations

import pytest
from django.contrib import admin


class TestBaseAdmin:
    """Tests for base admin."""

    @pytest.mark.django_db
    def test_admin_site_exists(self):
        """Test that admin site exists."""
        assert admin.site is not None
