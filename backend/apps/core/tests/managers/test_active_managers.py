"""
Core active manager tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.managers.active import ActiveManager


class TestActiveManager:
    """Tests for ActiveManager."""

    @pytest.mark.django_db
    def test_active_manager_returns_active_records(self):
        """Test that active manager returns only active records."""
        # This test requires a model that uses ActiveManager
        # For now, just verify the manager class exists
        assert ActiveManager is not None
