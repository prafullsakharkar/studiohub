"""
Core base integration tests.
"""

from __future__ import annotations

import pytest


class TestBaseIntegration:
    """Tests for base integration."""

    @pytest.mark.django_db
    def test_integration_test_exists(self):
        """Test that integration tests exist."""
        pass
