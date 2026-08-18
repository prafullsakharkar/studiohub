"""
Core tag filterset tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.filtersets.tag import TagFilterSet


class TestTagFilterSet:
    """Tests for TagFilterSet."""

    @pytest.mark.django_db
    def test_tag_filterset_exists(self):
        """Test that TagFilterSet class exists."""
        assert TagFilterSet is not None
