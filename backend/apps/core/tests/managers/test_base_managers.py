"""
Core base manager tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.managers.base import BaseManager


class TestBaseManager:
    """Tests for BaseManager."""

    @pytest.mark.django_db
    def test_base_manager_exists(self):
        """Test that BaseManager class exists."""
        assert BaseManager is not None
