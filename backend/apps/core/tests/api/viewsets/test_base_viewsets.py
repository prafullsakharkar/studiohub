"""
Core base viewset tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.viewsets.base import BaseViewSet


class TestBaseViewSet:
    """Tests for BaseViewSet."""

    @pytest.mark.django_db
    def test_base_viewset_exists(self):
        """Test that BaseViewSet class exists."""
        assert BaseViewSet is not None
