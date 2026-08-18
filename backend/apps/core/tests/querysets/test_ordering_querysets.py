"""
Core ordering queryset tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.querysets.mixins.ordering import OrderingQuerySetMixin


class TestOrderingQuerySetMixin:
    """Tests for OrderingQuerySetMixin."""

    @pytest.mark.django_db
    def test_ordering_mixin_exists(self):
        """Test that OrderingQuerySetMixin class exists."""
        assert OrderingQuerySetMixin is not None
