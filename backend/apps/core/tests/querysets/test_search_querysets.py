"""
Core search queryset tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.querysets.mixins.search import SearchQuerySetMixin


class TestSearchQuerySetMixin:
    """Tests for SearchQuerySetMixin."""

    @pytest.mark.django_db
    def test_search_mixin_exists(self):
        """Test that SearchQuerySetMixin class exists."""
        assert SearchQuerySetMixin is not None
