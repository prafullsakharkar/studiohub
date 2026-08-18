"""
Core base command tests.
"""

from __future__ import annotations

import pytest
from django.core.management.base import BaseCommand


class TestBaseCommand:
    """Tests for base commands."""

    @pytest.mark.django_db
    def test_base_command_exists(self):
        """Test that BaseCommand class exists."""
        assert BaseCommand is not None
