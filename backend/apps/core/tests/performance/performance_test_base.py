"""
Core base performance tests.
"""

from __future__ import annotations

import pytest


class TestBasePerformance:
    """Tests for base performance."""

    @pytest.mark.django_db
    def test_performance_test_exists(self):
        """Test that performance tests exist."""
        pass
