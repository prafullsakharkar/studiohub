"""
Core base permission tests.
"""

from __future__ import annotations

import pytest

from apps.core.permissions.base import BasePermission


class TestBasePermission:
    """Tests for BasePermission."""

    @pytest.mark.django_db
    def test_base_permission_exists(self):
        """Test that BasePermission class exists."""
        assert BasePermission is not None
