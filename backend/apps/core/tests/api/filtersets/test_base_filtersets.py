"""
Core base filterset tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.filtersets.base import BaseFilterSet


class TestBaseFilterSet:
    """Tests for BaseFilterSet."""

    @pytest.mark.django_db
    def test_base_filterset_exists(self):
        """Test that BaseFilterSet class exists."""
        assert BaseFilterSet is not None
