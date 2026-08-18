"""
Core lifecycle queryset tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.querysets.mixins.lifecycle import LifecycleQuerySetMixin


class TestLifecycleQuerySetMixin:
    """Tests for LifecycleQuerySetMixin."""

    @pytest.mark.django_db
    def test_lifecycle_mixin_exists(self):
        """Test that LifecycleQuerySetMixin class exists."""
        assert LifecycleQuerySetMixin is not None
