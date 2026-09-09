"""
Core base selector tests.
"""

from __future__ import annotations

import pytest

from apps.core.selectors.base import BaseSelector


class TestBaseSelector:
    """Tests for BaseSelector."""

    @pytest.mark.django_db
    def test_base_selector_exists(self):
        """Test that BaseSelector class exists."""
        assert BaseSelector is not None
